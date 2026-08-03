#!/bin/bash
# Lo que hace:
#   1. Instala Docker + AWS CLI + SSM Agent
#   2. Clona el repo del proyecto en /opt/app
#   3. Deja todo listo para recibir deploys via SSM

set -euo pipefail

# Log de todo lo que ocurre en el user-data (útil para depurar)
exec > >(tee -a /var/log/user-data.log) 2>&1

export DEBIAN_FRONTEND=noninteractive

# ---------- Paquetes base -------------
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release unzip git

# ---------- Docker ----------
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# ---------- Cambia propietario de usuario docker quitando sudo ----------
usermod -aG docker ubuntu
systemctl enable --now docker

# ---------- AWS CLI v2 ----------
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp/
/tmp/aws/install
rm -rf /tmp/aws /tmp/awscliv2.zip

# ---------- SSM Agent ----------
# En Ubuntu oficial de AWS ya viene preinstalado vía snap; solo aseguramos que esté activo.
systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service || \
  snap install amazon-ssm-agent --classic || true

# ---------- Parámetros desde SSM ----------
# Requiere IAM Instance Profile con permisos ssm:GetParameter (y kms:Decrypt si usas SecureString).
ECR_REGISTRY=$(aws ssm get-parameter --name /app/ecr-registry --query Parameter.Value --output text --region eu-north-1 2>/dev/null || echo "")
DATABASE_URL=$(aws ssm get-parameter --name /app/database-url --with-decryption --query Parameter.Value --output text --region eu-north-1 2>/dev/null || echo "")
GITHUB_TOKEN=$(aws ssm get-parameter --name /app/github-token --with-decryption --query Parameter.Value --output text --region eu-north-1 2>/dev/null || echo "")
GITHUB_REPO="Edison0315/Eventapp"
GITHUB_BRANCH="main"

mkdir -p /opt/app
cd /opt/app

if [ -n "$GITHUB_TOKEN" ]; then
  git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" . --branch "$GITHUB_BRANCH" --single-branch
else
  echo "WARNING: No se encontró /app/github-token en SSM Parameter Store."
  echo "Clonando sin token (repo debe ser público)."
  git clone "https://github.com/${GITHUB_REPO}.git" . --branch "$GITHUB_BRANCH" --single-branch
fi

# ---------- .env ----------
cat > /opt/app/.env <<EOF
# Variables de entorno de producción
PORT=3000
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}
ECR_REGISTRY=${ECR_REGISTRY}
EOF

chown -R ubuntu:ubuntu /opt/app
chmod 600 /opt/app/.env
chmod +x /opt/app/deploy.sh

echo "Bootstrap completo. La instancia puede recibir comandos SSM."
<div align="center">

# 🚀 Full-Stack Monorepo Platform

### Angular · NestJS · Nx · AWS · GitHub Actions

*Una arquitectura empresarial end-to-end que demuestra prácticas modernas de desarrollo, DevOps e Infrastructure as Code.*

![Nx](https://img.shields.io/badge/Nx-143055?style=for-the-badge&logo=nx&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

</div>

---

## 📖 Sobre el proyecto

Este repositorio es un **proof-of-concept de nivel productivo** que integra un frontend en Angular y un backend en NestJS bajo un **monorepo Nx**, empaquetado con Docker, publicado en **Amazon ECR** y desplegado automáticamente en AWS mediante un pipeline de **CI/CD con GitHub Actions**. Toda la infraestructura se gestiona como código, incluyendo la configuración de IAM y la gestión segura de secretos.

El objetivo es demostrar dominio del ciclo completo de desarrollo moderno: desde la organización del código y la calidad hasta el despliegue automatizado en la nube con buenas prácticas de seguridad.

---

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Nx Monorepo (TypeScript)                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐   │  │
│  │  │  Angular App │  │  NestJS API  │  │ Shared Libs │   │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘   │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │  push / PR
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI/CD                      │
│   Lint → Test → Build → Docker → Push ECR → Deploy AWS       │
└────────────────────────────┬─────────────────────────────────┘
                             │  OIDC / IAM Role
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                          AWS Cloud                           │
│    ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│    │   ECR    │──▶│  Compute     │──▶│ Secrets Manager  │    │
│    │ Registry │   │  (Container) │   │                  │    │
│    └──────────┘   └──────────────┘   └──────────────────┘    │
│                        IAM · Roles · Policies                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧰 Stack tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| **Monorepo** | Nx | Gestión unificada, caching, dependency graph, generadores |
| **Frontend** | Angular | SPA moderna, tipada y modular |
| **Backend** | NestJS | API escalable con arquitectura modular basada en decoradores |
| **Containerización** | Docker | Imágenes multi-stage optimizadas |
| **Registry** | Amazon ECR | Almacenamiento privado de imágenes |
| **Cloud** | AWS | Despliegue, ejecución y gestión de recursos |
| **Secretos** | AWS Secrets Manager | Gestión segura de credenciales |
| **Identidad** | AWS IAM | Roles, políticas y control de acceso |
| **CI/CD** | GitHub Actions | Automatización de build, test y deploy |
| **IaC** | GitHub Actions Workflows | Infraestructura y pipelines como código |

---

## ✨ Conocimientos demostrados

### 🏛️ Arquitectura y organización de código
- Diseño de un **monorepo Nx** con separación clara entre apps y librerías compartidas.
- Aprovechamiento del **grafo de dependencias** de Nx para builds y tests incrementales.
- Aplicación de principios **SOLID** y **modularidad** tanto en Angular como en NestJS.
- Estrategia de **shared libraries** para reutilizar tipos, DTOs y lógica entre front y back.

### 🎨 Frontend con Angular
- Estructura por módulos, servicios y componentes reutilizables.
- Consumo tipado de APIs mediante interfaces compartidas desde el backend.
- Buenas prácticas de rendimiento y organización de estado.

### ⚙️ Backend con NestJS
- Arquitectura modular con **controllers**, **services** y **providers**.
- Uso de **DTOs**, validación e inyección de dependencias.
- Diseño de APIs REST limpias y mantenibles.

### 🐳 Docker y empaquetado
- **Dockerfiles multi-stage** para reducir el tamaño final de las imágenes.
- Separación de entornos y configuración vía variables.
- Optimización de layers y build cache.

### ☁️ AWS y despliegue en la nube
- **Amazon ECR** como registry privado de imágenes Docker.
- Configuración de **IAM Roles** con el principio de **mínimo privilegio**.
- **AWS Secrets Manager** para credenciales, tokens y configuración sensible.
- Autenticación segura entre GitHub Actions y AWS mediante **OIDC** (sin claves de larga duración).

### 🔄 CI/CD con GitHub Actions
- Pipelines automatizados en cada `push` y `pull request`.
- Etapas de **lint → test → build → dockerize → push a ECR → deploy**.
- Uso de **matrices**, **caching** y **workflows reutilizables**.
- Despliegue continuo con separación entre entornos.

### 📜 Infrastructure as Code
- Definición declarativa de pipelines y configuración de despliegue.
- Versionado de la infraestructura junto al código de la aplicación.
- Reproducibilidad total del entorno desde el repositorio.

### 🔐 Seguridad
- Cero credenciales hardcodeadas en el código o en los workflows.
- Roles IAM específicos por servicio y por acción.
- Secretos gestionados exclusivamente vía AWS Secrets Manager y GitHub Secrets.

---

## 📂 Estructura del monorepo

```
├── apps/
│   ├── frontend/          # Aplicación Angular
│   └── backend/           # API NestJS
├── libs/
│   └── shared/            # Tipos, DTOs y utilidades compartidas
├── .github/
│   └── workflows/         # Pipelines de CI/CD
├── docker/                # Dockerfiles y configuración de contenedores
├── nx.json                # Configuración del monorepo
└── package.json
```
---

## 🔄 Flujo de CI/CD

1. **Push / PR** → dispara el workflow en GitHub Actions.
2. **Lint & Test** → validación de calidad del código.
3. **Build** → compilación incremental gracias a Nx.
4. **Docker Build** → imágenes multi-stage para cada aplicación.
5. **Push a ECR** → autenticación vía OIDC + IAM Role.
6. **Deploy en AWS** → despliegue del contenedor con secretos inyectados desde Secrets Manager.

---

## 🎯 Qué demuestra este proyecto

> Este repositorio no es solo un ejemplo técnico: es una **muestra de mi forma de trabajar**.

- Capacidad para diseñar **arquitecturas escalables end-to-end**.
- Dominio del **ecosistema TypeScript** en frontend y backend.
- Experiencia real con **AWS** y buenas prácticas de **seguridad en la nube**.
- Mentalidad **DevOps**: automatización, reproducibilidad y observabilidad.
- Enfoque **profesional**: código limpio, tipado, testeable y desplegable con un solo commit.
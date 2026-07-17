import { Routes } from '@angular/router';
import { ClientsComponent } from 'app/modules/admin/clients/clients.component';

// `ClientsComponent` is the sole routed component for this feature: it hosts
// both `clients-list` and `clients-form` internally via a `MatDrawerContainer`,
// with the drawer's create/edit mode driven by component events/signals, not
// by child routes (spec Decisions, lines 230-232, explicitly reject a
// `/clients/:id` route and the router-outlet approach originally stubbed
// here in Step 4). Fixed as part of Step 10 once the drawer architecture
// was implemented.
export default [
    {
        path     : '',
        component: ClientsComponent,
    },
] as Routes;

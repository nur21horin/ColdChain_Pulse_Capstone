// Which screens each role may open (PRD §3). The server enforces the real rules;
// the UI only hides what the server would refuse anyway.

import type { Role } from '@/types/domain';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  DISPATCHER: 'Dispatcher',
  DRIVER: 'Driver',
  CLINIC_RECEIVER: 'Clinic receiver',
  AUDITOR: 'External auditor',
};

export const ROUTE_ROLES = {
  '/board': ['ADMIN', 'DISPATCHER'],
  '/reports': ['ADMIN', 'DISPATCHER', 'AUDITOR'],
  '/driver': ['DRIVER', 'CLINIC_RECEIVER'],
} as const satisfies Record<string, readonly Role[]>;

export type GuardedRoute = keyof typeof ROUTE_ROLES;

export function canAccess(route: GuardedRoute, role: Role): boolean {
  return (ROUTE_ROLES[route] as readonly Role[]).includes(role);
}

export function homeFor(role: Role): GuardedRoute {
  switch (role) {
    case 'ADMIN':
    case 'DISPATCHER':
      return '/board';
    case 'AUDITOR':
      return '/reports';
    case 'DRIVER':
    case 'CLINIC_RECEIVER':
      return '/driver';
  }
}

/** Capabilities that change what a screen offers (buttons, actions). */
export const can = {
  createShipment: (r: Role) => r === 'ADMIN' || r === 'DISPATCHER',
  ackAlert: (r: Role) => r === 'ADMIN' || r === 'DISPATCHER' || r === 'DRIVER',
  downloadReport: (r: Role) => r === 'ADMIN' || r === 'DISPATCHER' || r === 'AUDITOR',
};

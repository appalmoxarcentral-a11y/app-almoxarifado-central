
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { UserPermissions } from '@/types';

interface PermissionCheckProps {
  permission: keyof UserPermissions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionCheck({ permission, children, fallback = null }: PermissionCheckProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

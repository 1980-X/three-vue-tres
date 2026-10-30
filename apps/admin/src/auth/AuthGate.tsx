import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { api } from '../api/client';

export type Me =
  | {
      kind: 'member';
      memberId: string;
      tenantId: string;
      email: string;
      displayName: string;
      isTenantOwner: boolean;
      projects: { id: string; name: string; role: string }[];
    }
  | {
      kind: 'platform_admin';
      email: string;
      platformAdminId: string;
    };

export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api<Me>('/auth/me')
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (me === undefined) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin tip="加载中…" />
      </div>
    );
  }
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

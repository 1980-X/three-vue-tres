import { useEffect, useState } from 'react';
import { Alert, Card, Spin, Typography } from 'antd';
import { api, type ApiError } from '../api/client';

type VenueDraft = {
  id: string;
  title: string;
  tracks: {
    id: string;
    title: string;
    trackKind: string;
    isPrimary: boolean;
    hotspots: { id: string; title: string }[];
    tours: { id: string; title: string }[];
  }[];
};

export function DraftPreview({ venueId }: { venueId: string }) {
  const [data, setData] = useState<VenueDraft | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<VenueDraft>(`/api/venues/${venueId}`)
      .then((v) => {
        if (!cancelled) {
          setData(v);
          setError('');
        }
      })
      .catch((e: ApiError) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  if (loading) return <Spin tip="加载草稿预览…" />;
  if (error) return <Alert type="error" message={error} />;
  if (!data) return null;

  const primary = data.tracks.find((t) => t.isPrimary) ?? data.tracks[0];

  return (
    <Card title="草稿预览（登录态）" size="small">
      <Typography.Paragraph>
        展馆：{data.title}（{data.id}）
      </Typography.Paragraph>
      <Typography.Paragraph>
        轨数：{data.tracks.length}
        {primary
          ? `；当前主轨「${primary.title}」(${primary.trackKind})，热点 ${primary.hotspots.length}，导览 ${primary.tours.length}`
          : '；尚无轨'}
      </Typography.Paragraph>
      <Typography.Text type="secondary">
        M3 将在此接入全景 / 3D 运行时；一期仅校验草稿 API 数据一致。
      </Typography.Text>
    </Card>
  );
}

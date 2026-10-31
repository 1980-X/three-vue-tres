import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Layout,
  Select,
  Space,
  Typography,
  message,
  List,
} from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type ApiError } from '../api/client';
import { GlbPreview } from '../components/GlbPreview';

type Provider = {
  id: string;
  name: string;
  kind: string;
  models: string[];
  enabled: boolean;
};

type LogLine = { t: string; text: string };

export function AiWorkbench() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [text, setText] = useState('做一个 threejs 展台');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: Provider[] }>('/api/ai/llm-providers')
      .then((d) => {
        setProviders(d.items.map((p) => ({ ...p, kind: 'llm', enabled: true })));
        if (d.items[0]) setProviderId(d.items[0].id);
      })
      .catch((e: ApiError) => {
        message.error(e.message);
        if (e.status === 401) navigate('/login', { replace: true });
      });
  }, [navigate]);

  async function ensureSession() {
    if (sessionId) return sessionId;
    if (!providerId) throw new Error('请选择 LLM');
    const s = await api<{ id: string }>(`/api/projects/${projectId}/agent/sessions`, {
      method: 'POST',
      body: JSON.stringify({ llmProviderId: providerId }),
    });
    setSessionId(s.id);
    return s.id;
  }

  async function send() {
    setBusy(true);
    setLogs([]);
    setPreviewUrl(undefined);
    try {
      const sid = await ensureSession();
      const res = await fetch(`/api/projects/${projectId}/agent/sessions/${sid}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`请求失败 ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const chunk of parts) {
          const lines = chunk.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(data) as Record<string, unknown>;
          } catch {
            parsed = { raw: data };
          }
          setLogs((prev) => [...prev, { t: event, text: JSON.stringify(parsed) }]);
          if (event === 'preview' && typeof parsed.previewPath === 'string') {
            setPreviewUrl(parsed.previewPath);
          }
          if (event === 'error') {
            message.error(String(parsed.message ?? '错误'));
          }
        }
      }
    } catch (e) {
      message.error((e as Error).message);
      if ((e as ApiError).status === 401) navigate('/login', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ background: '#001529' }}>
        <Space>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            AI 出模工作台
          </Typography.Title>
          <Link to={`/projects/${projectId}/assets`} style={{ color: '#91d5ff' }}>
            资产
          </Link>
          <Link to="/" style={{ color: '#91d5ff' }}>
            项目
          </Link>
        </Space>
      </Layout.Header>
      <Layout.Content style={{ padding: 24, maxWidth: 960 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Select
            style={{ width: 360 }}
            placeholder="选择 LLM（超管配置）"
            value={providerId}
            onChange={(v) => {
              setProviderId(v);
              setSessionId(undefined);
            }}
            options={providers.map((p) => ({
              value: p.id,
              label: `${p.name} (${(p.models ?? [])[0] ?? 'default'})`,
            }))}
          />
          <Input.TextArea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="描述要生成的草模…"
          />
          <Button type="primary" loading={busy} onClick={() => void send()}>
            发送
          </Button>
          {previewUrl ? <GlbPreview url={previewUrl} /> : null}
          <List
            header="事件"
            size="small"
            bordered
            dataSource={logs}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text code>{item.t}</Typography.Text> {item.text}
              </List.Item>
            )}
          />
        </Space>
      </Layout.Content>
    </Layout>
  );
}

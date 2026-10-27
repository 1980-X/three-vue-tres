import { useParams } from 'react-router-dom';

export function VenuePage() {
  const { publicId } = useParams();
  return <div>访客展馆占位：{publicId}</div>;
}

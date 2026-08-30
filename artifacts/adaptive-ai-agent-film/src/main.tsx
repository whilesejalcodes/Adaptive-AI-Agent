import { createRoot } from 'react-dom/client';
import VideoWithControls from '@/components/video/VideoWithControls';
import './index.css';

createRoot(document.getElementById('root')!).render(<VideoWithControls />);
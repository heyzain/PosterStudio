import { createRoot } from 'react-dom/client';
import { Workspace } from './workspace.jsx';
import { connectWorkspace } from '../workspace-ui.js';
import '../workspace.css';
import './tailwind.css';
import './warm-paper.css';

const root = createRoot(document.querySelector('#workspace-root'));
connectWorkspace(props => root.render(<Workspace {...props} />));

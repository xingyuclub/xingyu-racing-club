import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { getConfig, login, logout } from './adminApi.js';
import { ConfigEditor } from './ConfigEditor.jsx';
import './admin.css';

export default function AdminApp() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await login(credentials); setConfig(await getConfig()); }
    catch (next) { setError(next.status === 401 ? '账号或密码错误' : next.message); }
    finally { setBusy(false); }
  };
  const expire = (next) => {
    if (next.status === 401) { setConfig(null); setError('登录状态已失效，请重新登录'); return true; }
    return false;
  };

  if (!config) return <main className="admin-login"><form onSubmit={signIn}><h1>星屿配置后台</h1>{error && <p className="admin-error">{error}</p>}<label>账号<input value={credentials.username} onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} /></label><label>密码<input type="password" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} /></label><button disabled={busy}>登录</button></form></main>;

  return <main className="admin-page"><header><div><h1>星屿配置后台</h1><p>保存后，前台刷新即可看到最新内容</p></div><button className="icon-command" title="退出登录" onClick={async () => { await logout().catch(() => {}); setConfig(null); }}><LogOut size={18} />退出</button></header><ConfigEditor initialConfig={config} onAuthError={expire} /></main>;
}

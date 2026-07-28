import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { listUploads, saveConfig } from './adminApi.js';
import { UploadField } from './UploadField.jsx';
import { UploadLibrary } from './UploadLibrary.jsx';

const clone = (value) => structuredClone(value);
const labels = { name:'名称', label:'英文标识', motto:'车队口号', heroImage:'首屏图片', src:'素材路径', cover:'封面', id:'ID', number:'编号', role:'角色', points:'积分', wins:'胜场', avatar:'头像', videoUrl:'视频地址', title:'标题', category:'分类', date:'日期', imageSrc:'资讯图片', imageAlt:'图片说明', summary:'摘要', body:'正文', coverSrc:'相册封面', photos:'照片', alt:'替代文本', featured:'精选', mediaType:'媒体类型', weekday:'星期', rows:'成绩行', teamRace:'队内赛', openRace:'开黑赛', value:'数值' };
const empty = { roster:{ id:'',number:'',name:'',role:'队员',points:0,wins:0,avatar:'',videoUrl:'' }, news:{ id:'',title:'',category:'',date:'',imageSrc:'',imageAlt:'',summary:'',body:'' }, albums:{ id:'',name:'',date:'',coverSrc:'',photos:[] }, photos:{ id:'',src:'',title:'',date:'',alt:'',featured:false,mediaType:'image',videoUrl:'' }, dailyScores:{ date:'',weekday:'',rows:[] }, rows:{ id:'',teamRace:[0,0,0],openRace:[0,0,0] } };
function setAt(root, path, value) { const next=clone(root); let node=next; path.slice(0,-1).forEach((key)=>node=node[key]); node[path.at(-1)]=value; return next; }

function Field({ value, path, fieldKey, draft, setDraft, roster, refresh }) {
  const update=(next)=>setDraft((current)=>setAt(current,path,next));
  if (['heroImage','avatar','videoUrl','imageSrc','coverSrc','src','cover'].includes(fieldKey)) return <UploadField label={fieldKey === 'heroImage' ? '首屏图片上传' : `${labels[fieldKey] || fieldKey}上传`} value={value} onChange={update} onUploaded={refresh} />;
  if (typeof value === 'boolean') return <label className="check"><input type="checkbox" checked={value} onChange={(e)=>update(e.target.checked)} />{labels[fieldKey]||fieldKey}</label>;
  if (fieldKey === 'id' && path.includes('rows')) return <label>{labels[fieldKey]}<select value={value} onChange={(e)=>update(e.target.value)}><option value="">请选择成员</option>{roster.map((member)=><option key={member.id} value={member.id}>{member.number} {member.name}</option>)}</select></label>;
  const numeric=typeof value === 'number';
  return <label>{labels[fieldKey]||fieldKey}<input type={numeric?'number':'text'} value={value ?? ''} onChange={(e)=>update(numeric?Number(e.target.value):e.target.value)} /></label>;
}
function Tree({ value, path, fieldKey, draft, setDraft, roster, fixed=false, refresh }) {
  if (!Array.isArray(value) && (value === null || typeof value !== 'object')) return <Field {...{value,path,fieldKey,draft,setDraft,roster,refresh}} />;
  if (Array.isArray(value)) {
    const change=(next)=>setDraft((current)=>setAt(current,path,next));
    const template=empty[fieldKey] ?? (typeof value[0] === 'number' ? 0 : {});
    return <div className="array-field"><div className="array-title">{labels[fieldKey]||fieldKey}{!fixed && <button title="新增" onClick={()=>change([...value,{...clone(template),id:template.id === '' ? crypto.randomUUID() : template.id}])}><Plus size={16}/></button>}</div>{value.map((item,index)=><div className="array-item" key={item?.id || `${fieldKey}-${index}`}><div className="item-actions">{!fixed && <><button title="上移" disabled={!index} onClick={()=>{const n=[...value];[n[index-1],n[index]]=[n[index],n[index-1]];change(n)}}><ArrowUp size={15}/></button><button title="下移" disabled={index===value.length-1} onClick={()=>{const n=[...value];[n[index+1],n[index]]=[n[index],n[index+1]];change(n)}}><ArrowDown size={15}/></button><button title="删除" onClick={()=>change(value.filter((_,i)=>i!==index))}><Trash2 size={15}/></button></>}</div><Tree value={item} path={[...path,index]} fieldKey={fieldKey} {...{draft,setDraft,roster,refresh}} /></div>)}</div>;
  }
  return <div className="field-grid">{Object.entries(value).map(([key,item])=><Tree key={key} value={item} path={[...path,key]} fieldKey={key} fixed={['stats','teamRace','openRace'].includes(key)} {...{draft,setDraft,roster,refresh}} />)}</div>;
}
export function ConfigEditor({ initialConfig, onAuthError }) {
  const [draft,setDraft]=useState(()=>clone(initialConfig)); const [files,setFiles]=useState([]); const [status,setStatus]=useState(''); const [saving,setSaving]=useState(false);
  const loadFiles=()=>listUploads().then((next)=>setFiles(Array.isArray(next)?next:[])).catch((e)=>{if(!onAuthError(e))setStatus(e.message)});
  useEffect(() => { loadFiles(); }, []);
  const save=async()=>{setSaving(true);setStatus('');try{await saveConfig(draft);setStatus('已保存，前台刷新后可见最新内容');}catch(e){if(!onAuthError(e))setStatus([e.message,...e.details].join('\n'));}finally{setSaving(false)}};
  const sections=[['基础信息',{team:draft.team,music:draft.music}],['统计数据',draft.stats],['成员管理',draft.roster],['新闻管理',draft.news],['相册管理',draft.albums],['每日成绩',draft.dailyScores]];
  const appendUpload=(file)=>setFiles((current)=>current.some((item)=>item.name===file.name)?current:[...current,file]);
  return <>{sections.map(([title,value],index)=><section className="admin-section" key={title}><h2>{title}</h2><Tree value={value} path={index===0?[]:[['stats','roster','news','albums','dailyScores'][index-1]]} fieldKey={index===0?'base':['stats','roster','news','albums','dailyScores'][index-1]} fixed={title==='统计数据'} {...{draft,setDraft,roster:draft.roster,refresh:appendUpload}} /></section>)}<section className="admin-section"><h2>素材管理</h2><UploadLibrary files={files} setFiles={setFiles} onError={(e)=>setStatus(e.message)} /></section><div className="save-bar">{status && <p className={status.startsWith('已保存')?'admin-success':'admin-error'}>{status}</p>}<button disabled={saving} onClick={save}>保存全部配置</button></div></>;
}

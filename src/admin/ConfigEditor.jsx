import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { listUploads, saveConfig } from './adminApi.js';
import { UploadField } from './UploadField.jsx';
import { UploadLibrary } from './UploadLibrary.jsx';
import { RichTextEditor } from './RichTextEditor.jsx';
import { ScoreEditor } from './ScoreEditor.jsx';

const clone = (value) => structuredClone(value);
const labels = { name:'名称', heroLines:'首屏文案', label:'英文标识', motto:'车队口号', heroMedia:'首页主媒体', heroFallbackImage:'视频失败备用图', src:'素材路径', cover:'封面', id:'ID', role:'角色', avatar:'头像', videoUrl:'视频地址', title:'标题', category:'分类', date:'日期', imageSrc:'资讯图片', imageAlt:'图片说明', summary:'摘要', body:'正文', coverSrc:'相册封面', photos:'照片', alt:'替代文本', featured:'精选', mediaType:'媒体类型', value:'数值' };
const empty = { heroLines:'', roster:{ id:'',number:'',name:'',role:'队员',basePoints:0,wins:0,avatar:'',videoUrl:'' }, news:{ id:'',title:'',category:'',date:'',imageSrc:'',imageAlt:'',summary:'',body:'',bodyHtml:'' }, albums:{ id:'',name:'',date:'',coverSrc:'',photos:[] }, photos:{ id:'',src:'',title:'',date:'',alt:'',featured:false,mediaType:'image',videoUrl:'' } };
function setAt(root, path, value) { const next=clone(root); let node=next; path.slice(0,-1).forEach((key)=>node=node[key]); node[path.at(-1)]=value; return next; }
function nextMemberNumber(members) {
  const used = new Set(members.map((member) => String(member.number || '').trim()));
  let number = 1;
  while (used.has(String(number).padStart(2, '0'))) number += 1;
  return String(number).padStart(2, '0');
}
function nextMemberId(members) {
  const used = new Set(members.map((member) => String(member.id || '').trim()));
  let id = 1;
  while (used.has(String(id))) id += 1;
  return String(id);
}
function Field({ value, path, fieldKey, draft, setDraft, roster, refresh }) {
  const update=(next)=>setDraft((current)=>setAt(current,path,next));
  if (['heroFallbackImage','avatar','videoUrl','imageSrc','coverSrc','src','cover'].includes(fieldKey)) return <UploadField label={`${labels[fieldKey] || fieldKey}上传`} value={value} onChange={update} onUploaded={refresh} />;
  if (typeof value === 'boolean') return <label className="check"><input type="checkbox" checked={value} onChange={(e)=>update(e.target.checked)} />{labels[fieldKey]||fieldKey}</label>;
  if (fieldKey === 'id' && path.includes('rows')) return <label>{labels[fieldKey]}<select value={value} onChange={(e)=>update(e.target.value)}><option value="">请选择成员</option>{roster.map((member)=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>;
  const numeric=typeof value === 'number';
  const label = fieldKey === 'heroLines' && typeof path.at(-1) === 'number'
    ? `第 ${path.at(-1) + 1} 句`
    : labels[fieldKey] || fieldKey;
  return <label>{label}<input type={numeric?'number':'text'} value={value ?? ''} onChange={(e)=>update(numeric?Number(e.target.value):e.target.value)} /></label>;
}
function NewsFields({ item, path, draft, setDraft, roster, refresh }) {
  const updateField = (field, value) => setDraft((current) => setAt(current, [...path, field], value));
  const fieldProps = { draft, setDraft, roster, refresh };
  return <div className="news-fields"><div className="field-grid">{['id','title','category','date'].map((key)=><Field key={key} value={item[key]} path={[...path,key]} fieldKey={key} {...fieldProps} />)}</div><UploadField label="首页封面图上传" value={item.imageSrc} onChange={(value)=>updateField('imageSrc',value)} onUploaded={refresh} allowedTypes={['image']} /><div className="field-grid"><Field value={item.imageAlt} path={[...path,'imageAlt']} fieldKey="imageAlt" {...fieldProps} /><Field value={item.summary} path={[...path,'summary']} fieldKey="summary" {...fieldProps} /></div><RichTextEditor html={item.bodyHtml || ''} text={item.body || ''} onUploaded={refresh} onChange={(bodyHtml,body)=>setDraft((current)=>{const next=clone(current);let news=next;path.forEach((key)=>{news=news[key]});news.bodyHtml=bodyHtml;news.body=body;return next})} /></div>;
}
function ArrayItem({ item, index, value, fieldKey, fixed, change, path, draft, setDraft, roster, refresh }) {
  const isNews = fieldKey === 'news';
  const [collapsed, setCollapsed] = useState(isNews && Boolean(item?.title));
  const collapsible = fieldKey === 'roster' || isNews;
  const name = isNews ? item?.title || '未填写标题' : item?.name || '未命名成员';
  const summary = isNews
    ? `${name} · ${item?.category || '未填写分类'} · ${item?.date || '未填写日期'}`
    : `${name} · ID ${item?.id || '未填写'}`;
  return <div className={`array-item${collapsed ? ' is-collapsed' : ''}`}><div className="item-header">{collapsed && <strong className="item-summary">{summary}</strong>}<div className="item-actions">{collapsible && <button title={`${collapsed ? '展开' : '收起'} ${name}`} onClick={()=>setCollapsed((current)=>!current)}>{collapsed ? <ChevronDown size={15}/> : <ChevronUp size={15}/>}</button>}{!fixed && <><button title="上移" disabled={!index} onClick={()=>{const n=[...value];[n[index-1],n[index]]=[n[index],n[index-1]];change(n)}}><ArrowUp size={15}/></button><button title="下移" disabled={index===value.length-1} onClick={()=>{const n=[...value];[n[index+1],n[index]]=[n[index],n[index+1]];change(n)}}><ArrowDown size={15}/></button><button title="删除" onClick={()=>change(value.filter((_,i)=>i!==index))}><Trash2 size={15}/></button></>}</div></div>{!collapsed && <Tree value={item} path={[...path,index]} fieldKey={fieldKey} {...{draft,setDraft,roster,refresh}} />}</div>;
}
function Tree({ value, path, fieldKey, draft, setDraft, roster, fixed=false, refresh }) {
  if (fieldKey === 'heroMedia') {
    const update = (_path, result) => setDraft((current) => setAt(current, path, {
      src: result.path,
      type: result.type,
    }));
    return <UploadField label="首页主媒体上传" value={value?.src} onChange={update} onUploaded={refresh} allowedTypes={['image', 'video']} />;
  }
  if (fieldKey === 'news' && value && !Array.isArray(value)) {
    return <NewsFields item={value} {...{path,draft,setDraft,roster,refresh}} />;
  }
  if (!Array.isArray(value) && (value === null || typeof value !== 'object')) return <Field {...{value,path,fieldKey,draft,setDraft,roster,refresh}} />;
  if (Array.isArray(value)) {
    const change=(next)=>setDraft((current)=>setAt(current,path,next));
    const template=empty[fieldKey] ?? (typeof value[0] === 'number' ? 0 : {});
    const addItem = () => {
      const item = { ...clone(template), id: template.id === '' ? (fieldKey === 'roster' ? nextMemberId(value) : crypto.randomUUID()) : template.id };
      if (fieldKey === 'roster') item.number = nextMemberNumber(value);
      change([...value, item]);
    };
    return <div className="array-field"><div className="array-title">{labels[fieldKey]||fieldKey}{!fixed && <button title="新增" onClick={addItem}><Plus size={16}/></button>}</div>{value.map((item,index)=><ArrayItem key={index} {...{item,index,value,fieldKey,fixed,change,path,draft,setDraft,roster,refresh}} />)}</div>;
  }
  return <div className="field-grid">{Object.entries(value).filter(([key]) => key !== 'heroImage' && !(fieldKey === 'roster' && ['number', 'basePoints', 'wins'].includes(key))).map(([key,item])=><Tree key={key} value={item} path={[...path,key]} fieldKey={key} fixed={['stats','teamRace','openRace'].includes(key)} {...{draft,setDraft,roster,refresh}} />)}</div>;
}
export function ConfigEditor({ initialConfig, onAuthError }) {
  const [draft,setDraft]=useState(()=>clone(initialConfig)); const [files,setFiles]=useState([]); const [status,setStatus]=useState(''); const [saving,setSaving]=useState(false);
  const loadFiles=()=>listUploads().then((next)=>setFiles(Array.isArray(next)?next:[])).catch((e)=>{if(!onAuthError(e))setStatus(e.message)});
  useEffect(() => { loadFiles(); }, []);
  const save=async()=>{setSaving(true);setStatus('');try{await saveConfig(draft);setStatus('已保存，前台刷新后可见最新内容');}catch(e){if(!onAuthError(e))setStatus([e.message,...(e.details||[])].join('\n'));}finally{setSaving(false)}};
  const sections=[['基础信息',{team:draft.team,music:draft.music}],['统计数据',draft.stats],['成员管理',draft.roster],['新闻管理',draft.news],['相册管理',draft.albums]];
  const appendUpload=(file)=>setFiles((current)=>current.some((item)=>item.name===file.name)?current:[...current,file]);
  return <>{sections.map(([title,value],index)=><section className="admin-section" key={title}><h2>{title}</h2><Tree value={value} path={index===0?[]:[['stats','roster','news','albums'][index-1]]} fieldKey={index===0?'base':['stats','roster','news','albums'][index-1]} fixed={title==='统计数据'} {...{draft,setDraft,roster:draft.roster,refresh:appendUpload}} /></section>)}<section className="admin-section"><h2>星屿积分榜</h2><ScoreEditor config={draft} onChange={setDraft} /></section><section className="admin-section"><h2>素材管理</h2><UploadLibrary files={files} setFiles={setFiles} onError={(e)=>setStatus(e.message)} /></section><div className="save-bar">{status && <p className={status.startsWith('已保存')?'admin-success':'admin-error'}>{status}</p>}<button disabled={saving} onClick={save}>保存全部配置</button></div></>;
}
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { getConfig, listUploads, saveConfig } from './adminApi.js';
import { UploadField } from './UploadField.jsx';
import { UploadLibrary } from './UploadLibrary.jsx';
import { RichTextEditor } from './RichTextEditor.jsx';
import { ScoreEditor } from './ScoreEditor.jsx';

const clone = (value) => structuredClone(value);
const newId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const labels = { name:'名称', heroLines:'首屏文案', label:'英文标识', motto:'车队口号', heroMedia:'首页主媒体', heroFallbackImage:'视频失败备用图', src:'素材路径', cover:'封面', id:'ID', scoreMemberId:'积分人物', role:'角色', signature:'个性签名', avatar:'头像', videoUrl:'视频地址', title:'标题', category:'分类', date:'日期', imageSrc:'资讯图片', imageAlt:'图片说明', summary:'摘要', body:'正文', coverSrc:'相册封面', password:'访问密码', photos:'照片', alt:'替代文本', featured:'精选', mediaType:'媒体类型', pinned:'置顶', newsCategories:'分类列表', value:'数值' };
const empty = { heroLines:'', roster:{ id:'',number:'',name:'',scoreMemberId:'',role:'队员',signature:'',basePoints:0,wins:0,avatar:'',videoUrl:'' }, news:{ id:'',title:'',category:'',date:'',imageSrc:'',imageAlt:'',summary:'',body:'',bodyHtml:'',pinned:false }, albums:{ id:'',name:'',date:'',coverSrc:'',password:'',photos:[] }, photos:{ id:'',src:'',title:'',date:'',alt:'',featured:false,mediaType:'image',videoUrl:'' } };
const hiddenMediaFields = new Set([
  'originalSrc', 'originalSize', 'posterSrc', 'thumbSrc', 'cardSrc', 'width', 'height', 'duration',
  'avatarThumb', 'avatarCard', 'avatarOriginalSrc', 'avatarOriginalSize',
  'videoPosterSrc', 'videoOriginalUrl', 'videoOriginalSize', 'videoWidth', 'videoHeight', 'videoDuration',
  'coverThumbSrc', 'coverCardSrc', 'coverOriginalSrc', 'coverOriginalSize',
]);

function assignIfPresent(target, key, value) {
  if (value !== undefined && value !== null && value !== '') target[key] = value;
}

function getAt(value, path) {
  return path.reduce((current, key) => current?.[key], value);
}

export function applyUploadResult(config, path, result) {
  const next = clone(config);
  let parent = next;
  path.slice(0, -1).forEach((key) => { parent = parent[key]; });
  const fieldKey = path.at(-1);
  const display = result.variants?.display || result.path;
  const card = result.variants?.card || display;
  const thumb = result.variants?.thumb || card;

  if (fieldKey === 'avatar') {
    parent.avatar = card;
    parent.avatarThumb = thumb;
    parent.avatarCard = card;
    assignIfPresent(parent, 'avatarOriginalSrc', result.originalPath);
    assignIfPresent(parent, 'avatarOriginalSize', result.size);
    return next;
  }

  if (fieldKey === 'videoUrl') {
    parent.videoUrl = result.path;
    assignIfPresent(parent, 'videoPosterSrc', result.posterPath);
    assignIfPresent(parent, 'videoOriginalUrl', result.originalPath);
    assignIfPresent(parent, 'videoOriginalSize', result.size);
    assignIfPresent(parent, 'videoWidth', result.metadata?.width);
    assignIfPresent(parent, 'videoHeight', result.metadata?.height);
    assignIfPresent(parent, 'videoDuration', result.metadata?.duration);
    if (path[0] === 'albums') {
      parent.mediaType = 'video';
      if (result.posterPath) {
        parent.src = result.posterPath;
        parent.thumbSrc = result.posterPath;
        parent.cardSrc = result.posterPath;
      }
    }
    return next;
  }

  if (fieldKey === 'src' && path[0] === 'albums') {
    parent.src = display;
    parent.thumbSrc = thumb;
    parent.cardSrc = card;
    assignIfPresent(parent, 'originalSrc', result.originalPath);
    assignIfPresent(parent, 'originalSize', result.size);
    return next;
  }

  if (fieldKey === 'coverSrc') {
    parent.coverSrc = card;
    parent.coverThumbSrc = thumb;
    parent.coverCardSrc = card;
    assignIfPresent(parent, 'coverOriginalSrc', result.originalPath);
    assignIfPresent(parent, 'coverOriginalSize', result.size);
    return next;
  }

  parent[fieldKey] = fieldKey === 'imageSrc' || fieldKey === 'cover' ? card : display;
  return next;
}
function createDraft(config) {
  const draft = clone(config);
  draft.newsCategories = Array.isArray(draft.newsCategories) ? draft.newsCategories : [];
  draft.roster = draft.roster.map((member) => ({
    ...empty.roster,
    ...member,
    signature: typeof member.signature === 'string' ? member.signature : '',
  }));
  draft.albums = draft.albums.map((album) => ({
    ...album,
    password: typeof album.password === 'string' ? album.password : '',
  }));
  const rosterIds = new Set(draft.roster.map((member) => member.id));
  draft.memberAliases = (Array.isArray(draft.memberAliases) ? draft.memberAliases : []).filter(
    (alias) => rosterIds.has(alias.memberId),
  );
  return draft;
}
function restoreReferencedScoreMembers(config, latestConfig) {
  const referencedIds = new Set([
    ...(config.roster || []).map((member) => member.scoreMemberId),
    ...(config.dailyScores || []).flatMap((round) => (round.rows || []).map((row) => row.id)),
    ...(config.weekendScores || []).flatMap((round) => (round.rows || []).map((row) => row.id)),
  ].filter(Boolean));
  const currentIds = new Set((config.scoreMembers || []).map((member) => member.id));
  const missing = (latestConfig.scoreMembers || [])
    .filter((member) => referencedIds.has(member.id) && !currentIds.has(member.id));
  if (!missing.length) return config;
  return {
    ...config,
    scoreMembers: [...config.scoreMembers, ...clone(missing)],
  };
}
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
  if (['heroFallbackImage','avatar','videoUrl','imageSrc','coverSrc','src','cover'].includes(fieldKey)) {
    const allowedTypes = fieldKey === 'videoUrl'
      ? ['video']
      : fieldKey === 'src' && path[0] === 'music'
        ? ['audio']
        : ['image'];
    const parent = getAt(draft, path.slice(0, -1)) || {};
    const displayValue = {
      avatar: parent.avatarOriginalSrc,
      videoUrl: parent.videoOriginalUrl,
      coverSrc: parent.coverOriginalSrc,
      src: parent.originalSrc,
    }[fieldKey];
    return <UploadField label={`${labels[fieldKey] || fieldKey}上传`} value={value} displayValue={displayValue} onChange={(_value, result)=>setDraft((current)=>applyUploadResult(current,path,result))} onUploaded={refresh} allowedTypes={allowedTypes} />;
  }
  if (typeof value === 'boolean') return <label className="check"><input type="checkbox" checked={value} onChange={(e)=>update(e.target.checked)} />{labels[fieldKey]||fieldKey}</label>;
  if (fieldKey === 'password') return <label>{labels[fieldKey]}<input type="password" value={value || ''} autoComplete="new-password" onChange={(e)=>update(e.target.value)} /></label>;
  if (fieldKey === 'id' && path.includes('rows')) return <label>{labels[fieldKey]}<select value={value} onChange={(e)=>update(e.target.value)}><option value="">请选择成员</option>{roster.map((member)=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>;
  if (fieldKey === 'scoreMemberId') {
    const rosterIndex = path[0] === 'roster' ? path[1] : -1;
    const usedByOthers = new Set((draft.roster || [])
      .filter((_, index) => index !== rosterIndex)
      .map((member) => member.scoreMemberId)
      .filter(Boolean));
    return <label>{labels[fieldKey]}<select value={value || ''} onChange={(e)=>update(e.target.value)}><option value="">未绑定</option>{(draft.scoreMembers || []).map((member)=><option key={member.id} value={member.id} disabled={usedByOthers.has(member.id)}>{member.name}</option>)}</select></label>;
  }
  const numeric=typeof value === 'number';
  const label = fieldKey === 'heroLines' && typeof path.at(-1) === 'number'
    ? `第 ${path.at(-1) + 1} 句`
    : labels[fieldKey] || fieldKey;
  return <label>{label}<input type={numeric?'number':'text'} value={value ?? ''} onChange={(e)=>update(numeric?Number(e.target.value):e.target.value)} /></label>;
}
function NewsFields({ item, path, draft, setDraft, roster, refresh }) {
  const updateField = (field, value) => setDraft((current) => setAt(current, [...path, field], value));
  const fieldProps = { draft, setDraft, roster, refresh };
  return <div className="news-fields"><div className="field-grid">{['id','title','category','date'].map((key)=><Field key={key} value={item[key]} path={[...path,key]} fieldKey={key} {...fieldProps} />)}</div><UploadField label="首页封面图上传" value={item.imageSrc} onChange={(value)=>updateField('imageSrc',value)} onUploaded={refresh} allowedTypes={['image']} /><div className="field-grid"><Field value={item.imageAlt} path={[...path,'imageAlt']} fieldKey="imageAlt" {...fieldProps} /><Field value={item.summary} path={[...path,'summary']} fieldKey="summary" {...fieldProps} /></div><div className="field-grid"><Field value={Boolean(item.pinned)} path={[...path,'pinned']} fieldKey="pinned" {...fieldProps} /></div><RichTextEditor html={item.bodyHtml || ''} text={item.body || ''} onUploaded={refresh} onChange={(bodyHtml,body)=>setDraft((current)=>{const next=clone(current);let news=next;path.forEach((key)=>{news=news[key]});news.bodyHtml=bodyHtml;news.body=body;return next})} /></div>;
}
function CategoriesEditor({ value, onChange }) {
  const update = (index, next) => onChange(value.map((item, i) => (i === index ? next : item)));
  const remove = (index) => onChange(value.filter((_, i) => i !== index));
  const add = () => onChange([...value, '']);
  return <div className="array-field news-categories-field"><div className="array-title">分类列表<button title="新增分类" onClick={add}><Plus size={16} /></button></div>{value.map((item, index) => <div className="category-row" key={index}><input value={item} placeholder="分类名称" onChange={(e) => update(index, e.target.value)} /><button title="删除分类" onClick={() => remove(index)}><Trash2 size={15} /></button></div>)}</div>;
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
      src: result.type === 'image' ? result.variants?.display || result.path : result.path,
      type: result.type,
      ...(result.originalPath ? { originalSrc: result.originalPath } : {}),
      ...(result.size !== undefined ? { originalSize: result.size } : {}),
      ...(result.posterPath ? { posterSrc: result.posterPath } : {}),
      ...(result.variants?.thumb ? { thumbSrc: result.variants.thumb } : {}),
      ...(result.variants?.card ? { cardSrc: result.variants.card } : {}),
      ...(result.metadata?.width ? { width: result.metadata.width } : {}),
      ...(result.metadata?.height ? { height: result.metadata.height } : {}),
      ...(result.metadata?.duration ? { duration: result.metadata.duration } : {}),
    }));
    return <UploadField label="首页主媒体上传" value={value?.src} displayValue={value?.originalSrc} onChange={update} onUploaded={refresh} allowedTypes={['image', 'video']} />;
  }
  if (fieldKey === 'news' && value && !Array.isArray(value)) {
    return <NewsFields item={value} {...{path,draft,setDraft,roster,refresh}} />;
  }
  if (!Array.isArray(value) && (value === null || typeof value !== 'object')) return <Field {...{value,path,fieldKey,draft,setDraft,roster,refresh}} />;
  if (Array.isArray(value)) {
    const change=(next)=>setDraft((current)=>setAt(current,path,next));
    const template=empty[fieldKey] ?? (typeof value[0] === 'number' ? 0 : {});
    const addItem = () => {
      const item = { ...clone(template), id: template.id === '' ? (fieldKey === 'roster' ? nextMemberId(value) : newId()) : template.id };
      if (fieldKey === 'roster') item.number = nextMemberNumber(value);
      change([...value, item]);
    };
    return <div className="array-field"><div className="array-title">{labels[fieldKey]||fieldKey}{!fixed && <button title="新增" onClick={addItem}><Plus size={16}/></button>}</div>{value.map((item,index)=><ArrayItem key={index} {...{item,index,value,fieldKey,fixed,change,path,draft,setDraft,roster,refresh}} />)}</div>;
  }
  return <div className="field-grid">{Object.entries(value).filter(([key]) => key !== 'heroImage' && !hiddenMediaFields.has(key) && !(fieldKey === 'roster' && ['number', 'basePoints', 'wins'].includes(key))).map(([key,item])=><Tree key={key} value={item} path={[...path,key]} fieldKey={key} fixed={['stats','teamRace','openRace'].includes(key)} {...{draft,setDraft,roster,refresh}} />)}</div>;
}
function AdminSection({ title, children }) {
  const [collapsed, setCollapsed] = useState(true);
  return <section className={`admin-section${collapsed ? ' is-collapsed' : ''}`}><button type="button" className="admin-section-toggle" aria-expanded={!collapsed} aria-label={`${collapsed ? '展开' : '收起'} ${title}`} onClick={()=>setCollapsed((value)=>!value)}><h2>{title}</h2>{collapsed ? <ChevronDown aria-hidden="true" size={18}/> : <ChevronUp aria-hidden="true" size={18}/>}</button>{!collapsed && children}</section>;
}
export function ConfigEditor({ initialConfig, onAuthError }) {
  const [draft,setDraft]=useState(()=>createDraft(initialConfig)); const [files,setFiles]=useState([]); const [status,setStatus]=useState(''); const [saving,setSaving]=useState(false);
  const loadFiles=()=>listUploads().then((next)=>setFiles(Array.isArray(next)?next:[])).catch((e)=>{if(!onAuthError(e))setStatus(e.message)});
  useEffect(() => { loadFiles(); }, []);
  const save=async()=>{setSaving(true);setStatus('');try{const normalized=createDraft(draft);const complete=restoreReferencedScoreMembers(normalized,await getConfig());await saveConfig(complete);setDraft(complete);setStatus('已保存，前台刷新后可见最新内容');}catch(e){if(!onAuthError(e))setStatus([e.message,...(e.details||[])].join('\n'));}finally{setSaving(false)}};
  const sections=[['基础信息',{team:draft.team,music:draft.music}],['统计数据',draft.stats],['成员管理',draft.roster],['新闻管理',draft.news],['相册管理',draft.albums]];
  const appendUpload=(file)=>setFiles((current)=>current.some((item)=>item.name===file.name)?current:[...current,file]);
  return <>{sections.map(([title,value],index)=><AdminSection title={title} key={title}>{title==='新闻管理' && <CategoriesEditor value={draft.newsCategories || []} onChange={(next)=>setDraft((current)=>({...clone(current),newsCategories:next}))} />}<Tree value={value} path={index===0?[]:[['stats','roster','news','albums'][index-1]]} fieldKey={index===0?'base':['stats','roster','news','albums'][index-1]} fixed={title==='统计数据'} {...{draft,setDraft,roster:draft.roster,refresh:appendUpload}} /></AdminSection>)}<AdminSection title="星屿积分榜"><ScoreEditor config={draft} onChange={setDraft} /></AdminSection><AdminSection title="素材管理"><UploadLibrary files={files} setFiles={setFiles} onError={(e)=>setStatus(e.message)} /></AdminSection><div className="save-bar">{status && <p className={status.startsWith('已保存')?'admin-success':'admin-error'}>{status}</p>}<button disabled={saving} onClick={save}>保存全部配置</button></div></>;
}

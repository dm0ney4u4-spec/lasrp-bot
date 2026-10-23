import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowDown, ArrowRight, ChevronDown, Menu, X, Shield, Radio, Flame, Route, ExternalLink, ImageOff } from 'lucide-react';
import { images, departmentGalleries, type ImageAsset } from './config/images';
import { site } from './config/site';
import { departments, type Department } from './config/departments';

export function Asset({asset,className='',eager=false}: {asset:ImageAsset;className?:string;eager?:boolean}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[asset.src]);
  return <picture className={`asset ${className}`}>
    {!failed && asset.webp && <source srcSet={asset.webp} type="image/webp"/>}
    <img src={failed?images.fallback.src:asset.src} alt={failed?'LASRP branded placeholder; requested image unavailable':asset.alt} style={{objectPosition:asset.position}} loading={eager?'eager':'lazy'} decoding="async" onError={e=>{if(!failed)setFailed(true);else e.currentTarget.hidden=true;}}/>
  </picture>;
}
export function External({href,children,className='button',...props}:{href:string;children:ReactNode;className?:string;'aria-label'?:string}){
  return <a href={href} className={className} target="_blank" rel="noopener noreferrer" {...props}>{children}<ExternalLink size={14} aria-hidden="true"/><span className="sr-only"> (opens in a new tab)</span></a>;
}
export function Eyebrow({children}:{children:ReactNode}) {return <p className="eyebrow"><span/>{children}</p>;}
export function Soon({children='Coming soon'}:{children?:ReactNode}) {return <span className="status muted"><span/>{children}</span>;}
export function Heading({kicker,title,description,children}:{kicker:string;title:string;description?:string;children?:ReactNode}){
  return <div className="section-heading"><div><Eyebrow>{kicker}</Eyebrow><h2>{title}</h2>{description&&<p>{description}</p>}</div>{children}</div>;
}
export function Hero({kicker,title,description,image,children,compact=false}:{kicker:string;title:string;description:string;image:ImageAsset;children?:ReactNode;compact?:boolean}){
  return <section className={`page-hero ${compact?'compact':''}`}><Asset asset={image} eager className="hero-art"/><div className="hero-shade"/><div className="container hero-content"><Eyebrow>{kicker}</Eyebrow><h1>{title}</h1><p>{description}</p>{children&&<div className="button-row">{children}</div>}</div><div className="hero-coordinates" aria-hidden="true">LASRP / ER:LC COMMUNITY<span>CALIFORNIA INSPIRED. COMMUNITY DRIVEN.</span></div></section>;
}
export function DepartmentIcon({slug,size=22}:{slug:string;size?:number}) {const Icon=slug==='lafd'?Flame:slug==='dot'?Route:Shield;return <Icon size={size} strokeWidth={1.4} aria-hidden="true"/>;}
export function DepartmentCard({department:d,index}:{department:Department;index:number}){
  return <article className="department-card" style={{'--department-accent':d.accent} as CSSProperties}><Asset asset={d.image}/><div className="department-card-content"><span className="card-index">0{index+1} / <DepartmentIcon slug={d.slug}/></span><p className="eyebrow">{d.category}</p><h3>{d.short}</h3><p>{d.name}</p><Link to={`/departments/${d.slug}`} className="card-action">Explore department <ArrowRight size={18}/></Link><DepartmentJoin department={d} className="department-discord"/></div></article>;
}
export function DepartmentJoin({department,children,className='button'}:{department:Department;children?:ReactNode;className?:string}){return department.invite?<External href={department.invite} className={className}>{children??'Join Department Discord'}</External>:<Soon>CHP Discord — Coming Soon</Soon>;}
export function PlaceholderGallery({department}:{department:Department}){
  const [active,setActive]=useState(0);
  const slides=departmentGalleries[department.slug];
  return <div className="gallery"><div className="gallery-stage"><Asset asset={slides[active].asset}/><div><ImageOff size={26} aria-hidden="true"/><Soon>Approved imagery coming soon</Soon><h3 aria-live="polite">{slides[active].label}</h3><p>Original ER:LC imagery will be published here. This is branded artwork, not a game screenshot.</p></div></div><div className="gallery-controls" role="group" aria-label="Gallery views">{slides.map(({label},i)=><button key={label} aria-pressed={active===i} onClick={()=>setActive(i)}>{String(i+1).padStart(2,'0')}<span>{label}</span><ArrowRight size={16}/></button>)}</div></div>;
}
export function SiteLayout({children}:{children:ReactNode}){
  const location=useLocation(),[mobile,setMobile]=useState(false),[dropdown,setDropdown]=useState<string|null>(null);
  const navigation=useRef<HTMLElement>(null),previousPath=useRef(location.pathname);
  useEffect(()=>{setMobile(false);setDropdown(null);window.scrollTo({top:0,behavior:'instant'});if(previousPath.current===location.pathname)return;previousPath.current=location.pathname;document.getElementById('main-content')?.focus({preventScroll:true});},[location.pathname]);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(navigation.current&&!navigation.current.contains(event.target as Node))setDropdown(null);};document.addEventListener('click',close);return()=>document.removeEventListener('click',close);},[]);
  function dismiss(event:React.KeyboardEvent){if(event.key==='Escape'){if(dropdown){const trigger=(event.target as HTMLElement).closest('.nav-dropdown')?.querySelector('button');setDropdown(null);trigger?.focus();}else{setMobile(false);(navigation.current?.querySelector('.mobile-toggle') as HTMLElement)?.focus();}}}
  return <><a className="skip-link" href="#main-content">Skip to content</a><div className="topline"><div className="container"><span>LOS ANGELES STATE ROLEPLAY</span><span>Built for better roleplay.<span className="topline-divider">/</span>ER:LC</span></div></div>
    <header className="site-header"><nav ref={navigation} className="container nav" aria-label="Main navigation" onKeyDown={dismiss}>
      <Link to="/" className="brand" aria-label="LASRP homepage"><Asset asset={images.logo} eager/><span>LOS ANGELES<small>STATE ROLEPLAY</small></span></Link>
      <button className="mobile-toggle" aria-label={mobile?'Close navigation':'Open navigation'} aria-expanded={mobile} aria-controls="main-navigation" onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button>
      <div id="main-navigation" className={`nav-links ${mobile?'open':''}`}><NavLink to="/" end>Home</NavLink>
        <div className="nav-dropdown"><button aria-expanded={dropdown==='departments'} aria-controls="department-navigation" onClick={()=>setDropdown(dropdown==='departments'?null:'departments')}>Departments<ChevronDown size={13}/></button>{dropdown==='departments'&&<div id="department-navigation" className="dropdown-panel"><Link to="/departments">All departments <ArrowRight size={14}/></Link>{departments.map(d=><Link key={d.slug} to={`/departments/${d.slug}`}><DepartmentIcon slug={d.slug} size={16}/>{d.short}</Link>)}</div>}</div>
        <NavLink to="/applications">Applications</NavLink><div className="nav-dropdown"><button aria-expanded={dropdown==='community'} aria-controls="community-navigation" onClick={()=>setDropdown(dropdown==='community'?null:'community')}>Community<ChevronDown size={13}/></button>{dropdown==='community'&&<div id="community-navigation" className="dropdown-panel">{[['/community','About LASRP'],['/community/rules','Community rules'],['/sessions','Sessions'],['/community/news','News & updates'],['/community/guides','Guides & resources'],['/community/contact','Contact & support']].map(([url,label])=><Link key={url} to={url}>{label}</Link>)}</div>}</div>
        <NavLink to="/server-status">Live status</NavLink><NavLink to="/cad">CAD / MDT</NavLink><NavLink to="/staff">Staff portal</NavLink><External href={site.discord} className="nav-account">Join Our Discord</External>
      </div></nav></header>
    <main id="main-content" tabIndex={-1} key={location.pathname} className="page-enter">{children}</main>
    <footer className="site-footer"><div className="container footer-grid"><div><Link to="/" className="brand"><Asset asset={images.logo}/><span>LOS ANGELES<small>STATE ROLEPLAY</small></span></Link><p>A shared world. A higher standard.<br/>Your next chapter starts here.</p><span className="footer-note">An independent ER:LC roleplay community.</span></div><div><h2>Discover</h2><Link to="/departments">Our departments</Link><Link to="/community">About the community</Link><Link to="/sessions">Session information</Link><Link to="/community/news">News & announcements</Link></div><div><h2>Get involved</h2><Link to="/applications">Recruitment</Link><Link to="/community/guides">Guides & resources</Link><Link to="/community/rules">Community rules</Link><Link to="/community/contact">Contact & support</Link></div><div><h2>Operations</h2><Link to="/cad">CAD / MDT</Link><Link to="/staff">Staff portal</Link><Link to="/profile">Member access</Link><External href={site.discord} className="button footer-discord">Join Our Discord</External></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Los Angeles State Roleplay</span><span>Not affiliated with Roblox, PRC, or real emergency services.</span><a href="#main-content">Back to top <ArrowDown size={12} className="rotate"/></a></div></footer></>;
}
export function Feature({icon:Icon=Radio,title,children}:{icon?:typeof Radio;title:string;children:ReactNode}){return <article className="feature"><Icon size={24} strokeWidth={1.4} aria-hidden="true"/><h3>{title}</h3><p>{children}</p></article>;}

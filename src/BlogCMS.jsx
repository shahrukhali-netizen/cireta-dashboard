import { useState, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════
   CONFIG FROM ENV
   ═══════════════════════════════════════════ */
const ENV_FB_CONFIG = {
  apiKey: import.meta.env.VITE_FB_API_KEY || "",
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FB_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FB_APP_ID || "",
};
const HAS_ENV_CONFIG = !!ENV_FB_CONFIG.projectId;

const CDN_BASE = "https://cdn.cireta.com/cireta-home/";
const LISTING_PATH = ["content", "cireta_home", "blogs_listing"];
const DETAIL_PATH = ["content", "cireta_home", "blog_detail"];

/* ═══════════════════════════════════════════
   FIREBASE LOADER (Firestore + Auth — images go to cdn.cireta.com GCS bucket)
   ═══════════════════════════════════════════ */
const FB_CDN = "https://www.gstatic.com/firebasejs/10.12.2";
const ALLOWED_DOMAIN = "bigimmersive.com";
let db = null, FM = null, auth = null, AM = null;

async function bootFirebase(config) {
  if (db) return { db, auth };
  const { initializeApp } = await import(/* @vite-ignore */ `${FB_CDN}/firebase-app.js`);
  const fsMod = await import(/* @vite-ignore */ `${FB_CDN}/firebase-firestore.js`);
  const authMod = await import(/* @vite-ignore */ `${FB_CDN}/firebase-auth.js`);
  const app = initializeApp(config);
  db = fsMod.getFirestore(app);
  auth = authMod.getAuth(app);
  FM = fsMod;
  AM = authMod;
  return { db, auth };
}

function isAllowedEmail(email) {
  return !!(email && email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN));
}

/* ═══════════════════════════════════════════
   CATEGORIES (values match existing Firestore + public site)
   ═══════════════════════════════════════════ */
const CATEGORIES = [
  { value: "blog", label: "Blog", color: "#0d9488", bg: "#0d948820" },
  { value: "top-story", label: "Top Stories", color: "#f59e0b", bg: "#f59e0b20" },
  { value: "press", label: "Press", color: "#8b5cf6", bg: "#8b5cf620" },
];
const getCategory = (v) => CATEGORIES.find(c => c.value === v) || CATEGORIES[0];

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
function toSlug(t){return t.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"");}

function parseMd(md){
  if(!md)return"";
  return md
    .replace(/^### (.*$)/gim,"<h3>$1</h3>").replace(/^## (.*$)/gim,"<h2>$1</h2>").replace(/^# (.*$)/gim,"<h1>$1</h1>")
    .replace(/\*\*\*(.*?)\*\*\*/gim,"<strong><em>$1</em></strong>").replace(/\*\*(.*?)\*\*/gim,"<strong>$1</strong>").replace(/\*(.*?)\*/gim,"<em>$1</em>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim,'<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:12px 0"/>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim,'<a href="$2" style="color:#2dd4bf">$1</a>')
    .replace(/```([\s\S]*?)```/gim,'<pre style="background:#0c1222;padding:16px;border-radius:8px;overflow-x:auto;border:1px solid #1e293b"><code style="color:#5eead4;font-size:13px">$1</code></pre>')
    .replace(/`([^`]+)`/gim,'<code style="background:#1e293b;color:#5eead4;padding:2px 6px;border-radius:4px;font-size:.9em">$1</code>')
    .replace(/^> (.*$)/gim,'<blockquote style="border-left:3px solid #0d9488;padding:8px 16px;color:#94a3b8;margin:14px 0;background:#0c1222;border-radius:0 6px 6px 0">$1</blockquote>')
    .replace(/^---$/gim,'<hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>').replace(/^\- (.*$)/gim,"<li>$1</li>")
    .replace(/^\d+\. (.*$)/gim,"<li>$1</li>").replace(/\n\n/g,"</p><p>").replace(/^(?!<[hluobp])/gim,"<p>")+"</p>";
}

const listingCol = () => FM.collection(db, ...LISTING_PATH);
const detailCol = () => FM.collection(db, ...DETAIL_PATH);
const listingDoc = (id) => FM.doc(db, ...LISTING_PATH, id);
const detailDoc = (id) => FM.doc(db, ...DETAIL_PATH, id);

const fullImgUrl = (rel) => rel ? (rel.startsWith("http") ? rel : `${CDN_BASE}${rel}`) : "";

function buildSchemas(p){
  const o=[];
  const canonical = p.canonicalUrl || `https://cireta.com/insights/${p.slug}`;
  const categoryLabel = getCategory(p.category).label;
  o.push({"@context":"https://schema.org","@type":"BlogPosting",headline:p.seoTitle||p.title,description:p.seoDescription||p.excerpt||"",
    author:{"@type":"Person",name:p.author||"Cireta Research Team"},
    datePublished:p.date?new Date(p.date).toISOString():new Date().toISOString(),dateModified:new Date().toISOString(),
    image:p.ogImage||fullImgUrl(p.imgUrl)||"",keywords:(Array.isArray(p.tags)?p.tags:[]).join(", "),
    articleSection: categoryLabel,
    publisher:{"@type":"Organization",name:"Cireta",url:"https://cireta.com"},
    mainEntityOfPage:{"@type":"WebPage","@id":canonical}});
  o.push({"@context":"https://schema.org","@type":"BreadcrumbList",
    itemListElement:[{position:1,name:"Home",item:"https://cireta.com"},{position:2,name:"Insights",item:"https://cireta.com/insights"},{position:3,name:p.title,item:canonical}].map(i=>({...i,"@type":"ListItem"}))});
  if(p.faqItems?.length>0)o.push({"@context":"https://schema.org","@type":"FAQPage",
    mainEntity:p.faqItems.filter(f=>f.question&&f.answer).map(f=>({"@type":"Question",name:f.question,acceptedAnswer:{"@type":"Answer",text:f.answer}}))});
  return o;
}

/* ═══════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════ */
const I=({d,s=17,c})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
const ic={
  save:"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8",
  send:"M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  plus:"M12 5v14 M5 12h14",
  trash:"M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  edit:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  back:"M19 12H5 M12 19l-7-7 7-7",
  search:"M11 17.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5z M16 16l4.5 4.5",
  star:"M12 2l2.6 6.9L22 10l-5.5 5 1.6 7.5L12 18.8 5.9 22.5 7.5 15 2 10l7.4-1.1z",
  chev:"M6 9l6 6 6-6",
  copy:"M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  x:"M18 6L6 18 M6 6l12 12",
  db:"M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z M2 6.5C2 8.98 6.48 11 12 11s10-2.02 10-4.5 M2 12c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5",
  globe:"M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  bold:"M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z",italic:"M19 4h-9 M14 20H5 M15 4L9 20",
  h2:"M4 12h8 M4 18V6 M12 18V6 M17 10l3-4 3 4 M20 6v14",list:"M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  link:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  img:"M21 15l-5-5L5 21 M21 3H3v18h18V3z M9 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  code:"M16 18l6-6-6-6 M8 6l-6 6 6 6",quote:"M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
};

/* ═══════════════════════════════════════════
   MAIN CMS
   ═══════════════════════════════════════════ */
export default function CiretaBlogCMS() {
  const [view,setView]=useState("list");
  const [user,setUser]=useState(null);             // Firebase Auth user
  const [authLoading,setAuthLoading]=useState(true); // initial auth check
  const [signingIn,setSigningIn]=useState(false);
  const [authError,setAuthError]=useState("");
  const [fsConnected,setFsConnected]=useState(false);
  const [fsStatus,setFsStatus]=useState("");
  const [blogs,setBlogs]=useState([]);
  const [loading,setLoading]=useState(false);
  const [filter,setFilter]=useState("all");
  const [catFilter,setCatFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [delModal,setDelModal]=useState(null);
  const [editId,setEditId]=useState(null);              // listing doc id
  const [detailEditId,setDetailEditId]=useState(null);  // detail doc id
  const [fmt,setFmt]=useState("markdown");
  const [pane,setPane]=useState("split");
  const [saving,setSaving]=useState(false);
  const [seoOpen,setSeoOpen]=useState(false);
  const [faqOpen,setFaqOpen]=useState(false);
  const [schemaOpen,setSchemaOpen]=useState(false);
  const [toast,setToast]=useState(null);
  const taRef=useRef(null);

  const ins=(before,after="")=>{const ta=taRef.current;if(!ta)return;const{selectionStart:s,selectionEnd:e}=ta;const sel=post.content.substring(s,e);setPost(p=>({...p,content:p.content.substring(0,s)+before+sel+after+p.content.substring(e)}));setTimeout(()=>{ta.focus();ta.selectionStart=s+before.length;ta.selectionEnd=s+before.length+sel.length;},0);};
  const preview=()=>{if(fmt==="html")return post.content;if(fmt==="text")return`<div style="white-space:pre-wrap">${post.content.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>`;return parseMd(post.content);};

  const blank={
    title:"", slug:"", content:"", excerpt:"",
    category:"blog", status:"draft",
    imgUrl:"", isFeatured:false,
    // Authoring fields (persisted to blog_detail; not rendered by public site yet)
    author:"Cireta Research Team", authorDescription:"",
    tags:[], readTime:"",
    seoTitle:"", seoDescription:"", ogImage:"", canonicalUrl:"",
    faqItems:[],
  };
  const [post,setPost]=useState({...blank});

  const flash=(m,t="ok")=>{setToast({m,t});setTimeout(()=>setToast(null),3200);};

  const inp={width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #1e293b",background:"#0f172a",color:"#e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box"};
  const lbl={display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"};

  /* ── Firebase bootstrap + auth state ── */
  useEffect(()=>{
    let unsub=null;
    (async()=>{
      if(!HAS_ENV_CONFIG){setFsStatus("No env config");setAuthLoading(false);return;}
      try{
        await bootFirebase(ENV_FB_CONFIG);
        setFsConnected(true);setFsStatus("Connected");
        unsub=AM.onAuthStateChanged(auth,(u)=>{
          if(u&&!isAllowedEmail(u.email)){
            // Wrong domain — sign them out silently
            AM.signOut(auth);
            setUser(null);
            setAuthError(`Only @${ALLOWED_DOMAIN} accounts are allowed`);
          }else{
            setUser(u||null);
            setAuthError("");
            if(u)loadBlogs();
          }
          setAuthLoading(false);
        });
      }catch(e){setFsStatus("Error: "+e.message);setAuthLoading(false);}
    })();
    return()=>{if(unsub)unsub();};
    /* eslint-disable-next-line */
  },[]);

  const signIn=async()=>{
    if(!auth){flash("Firebase not ready","err");return;}
    setSigningIn(true);setAuthError("");
    try{
      const provider=new AM.GoogleAuthProvider();
      provider.setCustomParameters({hd:ALLOWED_DOMAIN,prompt:"select_account"});
      await AM.signInWithPopup(auth,provider);
      // onAuthStateChanged will handle the rest (including domain rejection)
    }catch(e){
      if(e.code==="auth/popup-closed-by-user"){/* user cancelled */}
      else setAuthError(e.message||"Sign-in failed");
    }
    setSigningIn(false);
  };

  const signOutUser=async()=>{
    if(!auth)return;
    try{await AM.signOut(auth);setBlogs([]);setView("list");}
    catch(e){flash("Sign-out failed","err");}
  };

  /* ── Load list (reads blogs_listing only — lightweight) ── */
  const loadBlogs=async()=>{
    if(!db)return;setLoading(true);
    try{
      const snap=await FM.getDocs(listingCol());
      const list=snap.docs.map(d=>{
        const x=d.data();
        return{
          id:d.id,
          title:x.title||"",
          slug:x.link||"",
          excerpt:x.paragraph||"",
          category:x.category||"blog",
          imgUrl:x.imgUrl||"",
          active:!!x.active,
          status:x.active?"published":"draft",
          isFeatured:!!x.is_featured,
          date:x.date||0,
        };
      });
      list.sort((a,b)=>(b.date||0)-(a.date||0));
      setBlogs(list);
    }catch(e){flash("Load failed: "+e.message,"err");}
    setLoading(false);
  };

  /* ── Open editor: new ── */
  const openNew=()=>{
    setEditId(null);setDetailEditId(null);
    setPost({...blank});
    setFmt("markdown");
    setView("editor");
    setSeoOpen(false);setFaqOpen(false);setSchemaOpen(false);
  };

  /* ── Open editor: edit (fetch detail content by slug) ── */
  const openEdit=async(b)=>{
    setEditId(b.id);
    setDetailEditId(null);
    setPost({
      ...blank,
      title:b.title||"",
      slug:b.slug||"",
      excerpt:b.excerpt||"",
      category:b.category||"blog",
      status:b.status||"draft",
      imgUrl:b.imgUrl||"",
      isFeatured:!!b.isFeatured,
      content:"",
    });
    setView("editor");
    setSeoOpen(false);setFaqOpen(false);setSchemaOpen(false);
    try{
      if(db&&b.slug){
        const q=FM.query(detailCol(),FM.where("blog-link","==",b.slug));
        const snap=await FM.getDocs(q);
        if(!snap.empty){
          const d=snap.docs[0];
          const x=d.data();
          setDetailEditId(d.id);
          setPost(p=>({
            ...p,
            content:x.content||"",
            // Load extra authoring fields if they exist (legacy docs won't have them)
            author:x.author||p.author,
            authorDescription:x.authorDescription||"",
            tags:Array.isArray(x.tags)?x.tags:[],
            readTime:x.readTime||"",
            seoTitle:x.seoTitle||"",
            seoDescription:x.seoDescription||"",
            ogImage:x.ogImage||"",
            canonicalUrl:x.canonicalUrl||"",
            faqItems:Array.isArray(x.faqItems)?x.faqItems:[],
          }));
        }
      }
    }catch(e){flash("Content load failed: "+e.message,"err");}
  };

  /* ── Save (dual-write) ── */
  const saveBlog=async(statusOverride)=>{
    if(!post.title.trim()){flash("Title required","err");return;}
    if(!post.content.trim()){flash("Content required","err");return;}
    if(!fsConnected){flash("Firebase not connected","err");return;}
    setSaving(true);
    const s=statusOverride||post.status;
    const sl=post.slug||toSlug(post.title);
    const active=s==="published";
    let dateMs=Date.now();
    if(editId){
      const existing=blogs.find(b=>b.id===editId);
      if(existing&&existing.date)dateMs=existing.date;
    }
    const tags=typeof post.tags==="string"
      ?post.tags.split(",").map(t=>t.trim()).filter(Boolean)
      :(post.tags||[]);

    // Resolve to full URL so public site can use it directly
    const resolvedImg = fullImgUrl(post.imgUrl);

    // Core listing fields (matches existing schema consumed by public site)
    const listingData={
      title:post.title,
      link:sl,
      paragraph:post.excerpt||"",
      category:post.category||"blog",
      active,
      is_featured:!!post.isFeatured,
      imgUrl:resolvedImg,
      date:dateMs,
    };
    // Detail = core fields public site uses + extra authoring fields persisted for future use
    const detailData={
      title:post.title,
      "blog-link":sl,
      content:post.content,
      active,
      imgUrl:resolvedImg,
      date:dateMs,
      // Extra authoring fields (ignored by current public site, kept for future)
      excerpt:post.excerpt||"",
      category:post.category||"blog",
      author:post.author||"",
      authorDescription:post.authorDescription||"",
      tags,
      readTime:post.readTime||"",
      seoTitle:post.seoTitle||"",
      seoDescription:post.seoDescription||"",
      ogImage:post.ogImage||"",
      canonicalUrl:post.canonicalUrl||"",
      faqItems:post.faqItems||[],
      schemas:buildSchemas({...post,slug:sl,tags,date:dateMs}),
      updatedAt:Date.now(),
    };
    try{
      if(editId){
        await FM.updateDoc(listingDoc(editId),listingData);
        if(detailEditId){
          await FM.updateDoc(detailDoc(detailEditId),detailData);
        }else{
          const ref=await FM.addDoc(detailCol(),detailData);
          setDetailEditId(ref.id);
        }
        setPost(p=>({...p,status:s}));
        flash("Updated");
      }else{
        const listingRef=await FM.addDoc(listingCol(),listingData);
        const detailRef=await FM.addDoc(detailCol(),detailData);
        setEditId(listingRef.id);
        setDetailEditId(detailRef.id);
        setPost(p=>({...p,status:s}));
        flash("Created");
      }
      loadBlogs();
    }catch(e){flash("Save failed: "+e.message,"err");}
    setSaving(false);
  };

  /* ── Delete (from both collections) ── */
  const deleteBlog=async(listingId)=>{
    if(!db)return;
    try{
      const entry=blogs.find(b=>b.id===listingId);
      await FM.deleteDoc(listingDoc(listingId));
      if(entry&&entry.slug){
        const q=FM.query(detailCol(),FM.where("blog-link","==",entry.slug));
        const snap=await FM.getDocs(q);
        for(const d of snap.docs){
          await FM.deleteDoc(detailDoc(d.id));
        }
      }
      flash("Deleted");
      setDelModal(null);
      loadBlogs();
    }catch(e){flash("Delete failed: "+e.message,"err");}
  };

  /* ── Derived ── */
  const shown=blogs.filter(b=>{
    if(filter==="published"&&!b.active)return false;
    if(filter==="draft"&&b.active)return false;
    if(catFilter!=="all"&&b.category!==catFilter)return false;
    if(search&&!(b.title||"").toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });
  const stats={
    total:blogs.length,
    blog:blogs.filter(b=>b.category==="blog"||!b.category).length,
    top:blogs.filter(b=>b.category==="top-story").length,
    press:blogs.filter(b=>b.category==="press").length,
  };
  const currentCat=getCategory(post.category);
  const imgUrl=fullImgUrl(post.imgUrl);
  const defaultCanonical=`https://cireta.com/insights/${post.slug||"your-slug"}`;

  /* ── Auth gate: show login screen if not signed in ── */
  if (authLoading) {
    return (
      <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:"#080e1e",color:"#94a3b8",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
        <div style={{textAlign:"center"}}>
          <div style={{width:44,height:44,border:"3px solid #1e293b",borderTopColor:"#0d9488",borderRadius:"50%",margin:"0 auto 16px",animation:"spin 1s linear infinite"}}/>
          <div style={{fontSize:13,fontWeight:600}}>Loading…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:"#080e1e",color:"#e2e8f0",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
        <div style={{maxWidth:380,width:"100%",background:"#111827",border:"1px solid #1e293b",borderRadius:14,padding:"36px 32px",textAlign:"center"}}>
          <div style={{width:56,height:56,borderRadius:14,background:"linear-gradient(135deg,#0d9488,#065f46)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:"#fff",fontWeight:800,margin:"0 auto 20px"}}>C</div>
          <h2 style={{margin:"0 0 8px",fontSize:20,fontWeight:700,color:"#f1f5f9"}}>Cireta Blog CMS</h2>
          <p style={{margin:"0 0 28px",fontSize:13,color:"#64748b",lineHeight:1.6}}>Sign in with your <strong style={{color:"#94a3b8"}}>@{ALLOWED_DOMAIN}</strong> Google account to continue.</p>
          <button onClick={signIn} disabled={signingIn} style={{width:"100%",padding:"12px 18px",borderRadius:9,border:"1px solid #334155",background:"#0f172a",color:"#f1f5f9",fontSize:14,fontWeight:600,cursor:signingIn?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:signingIn?.6:1}}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {signingIn?"Signing in…":"Sign in with Google"}
          </button>
          {authError&&<div style={{marginTop:16,padding:"10px 12px",borderRadius:8,background:"#450a0a",color:"#fca5a5",border:"1px solid #991b1b",fontSize:12,textAlign:"left"}}>{authError}</div>}
          {fsStatus&&fsStatus!=="Connected"&&<div style={{marginTop:14,fontSize:11,color:"#475569"}}>{fsStatus}</div>}
        </div>
      </div>
    );
  }

  return(
<div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:"#080e1e",color:"#e2e8f0",minHeight:"100vh",position:"relative"}}>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>{`
@keyframes fadeUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes pop{from{transform:translateX(80px);opacity:0}to{transform:translateX(0);opacity:1}}
input:focus,textarea:focus,select:focus{border-color:#0d9488!important;box-shadow:0 0 0 3px rgba(13,148,136,.12)!important}
tr:hover td{background:#0d142490!important}button{transition:all .15s}button:hover{opacity:.88}
.pp h1{font-size:26px;font-weight:800;color:#f1f5f9;margin:0 0 14px}.pp h2{font-size:20px;font-weight:700;color:#e2e8f0;margin:22px 0 10px;padding-bottom:8px;border-bottom:1px solid #1e293b}
.pp h3{font-size:17px;font-weight:700;color:#e2e8f0;margin:18px 0 8px}.pp p{margin:0 0 12px;line-height:1.8}
.pp li{margin:3px 0;line-height:1.7}.pp img{max-width:100%;border-radius:8px;margin:8px 0}.pp a{color:#2dd4bf;text-decoration:underline}
.pp blockquote{border-left:3px solid #0d9488;padding:8px 16px;color:#94a3b8;margin:14px 0;background:#0c1222;border-radius:0 6px 6px 0}
.pp pre{background:#0c1222;padding:16px;border-radius:8px;overflow-x:auto;border:1px solid #1e293b;margin:12px 0}.pp code{font-family:'JetBrains Mono',monospace}
*::-webkit-scrollbar{width:5px}*::-webkit-scrollbar-track{background:transparent}*::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px}
`}</style>

{toast&&<div style={{position:"fixed",top:16,right:16,padding:"12px 22px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:9999,animation:"pop .3s ease",background:toast.t==="err"?"#450a0a":"#052e16",color:toast.t==="err"?"#fca5a5":"#6ee7b7",border:`1px solid ${toast.t==="err"?"#991b1b":"#166534"}`}}>{toast.m}</div>}

{/* DELETE MODAL */}
{delModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={()=>setDelModal(null)}>
  <div style={{background:"#111827",border:"1px solid #1e293b",borderRadius:14,padding:28,maxWidth:380,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
    <h3 style={{margin:"0 0 10px",color:"#f1f5f9",fontSize:17}}>Delete this post?</h3>
    <p style={{color:"#94a3b8",fontSize:14,margin:"0 0 22px"}}>Removes from both <code style={{color:"#5eead4"}}>blogs_listing</code> and <code style={{color:"#5eead4"}}>blog_detail</code>. Cannot be undone.</p>
    <div style={{display:"flex",gap:10,justifyContent:"center"}}>
      <button style={{padding:"9px 20px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:13,fontWeight:600}} onClick={()=>setDelModal(null)}>Cancel</button>
      <button style={{padding:"9px 20px",borderRadius:8,border:"none",background:"#dc2626",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}} onClick={()=>deleteBlog(delModal)}>Delete</button>
    </div>
  </div>
</div>}

{/* HEADER */}
<div style={{borderBottom:"1px solid #1e293b",background:"#0b1120"}}>
<div style={{maxWidth:1320,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
  <div style={{display:"flex",alignItems:"center",gap:10}}>
    {view==="editor"&&<button style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:4,marginRight:4}} onClick={()=>{setView("list");if(fsConnected)loadBlogs();}}><I d={ic.back} s={20}/></button>}
    <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#0d9488,#065f46)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:800}}>C</div>
    <span style={{fontSize:16,fontWeight:700,color:"#0d9488",letterSpacing:"-.3px"}}>Blog CMS</span>
    <span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:fsConnected?"#052e16":"#422006",color:fsConnected?"#4ade80":"#fbbf24",border:`1px solid ${fsConnected?"#166534":"#854d0e"}`,fontWeight:600,marginLeft:4}}>{fsConnected?"Firebase ✓":fsStatus||"Not connected"}</span>
  </div>
  <div style={{display:"flex",gap:10,alignItems:"center"}}>
    {view==="list"&&<button style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#0d9488",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}} onClick={openNew}><I d={ic.plus} s={15}/>New Post</button>}
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px 4px 10px",borderRadius:20,background:"#0f172a",border:"1px solid #1e293b"}}>
      {user.photoURL
        ?<img src={user.photoURL} alt="" style={{width:24,height:24,borderRadius:"50%"}}/>
        :<div style={{width:24,height:24,borderRadius:"50%",background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#94a3b8"}}>{(user.email||"?").charAt(0).toUpperCase()}</div>}
      <span style={{fontSize:12,color:"#94a3b8",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</span>
      <button onClick={signOutUser} title="Sign out" style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:"4px 6px",borderRadius:6,display:"flex",alignItems:"center"}}><I d={ic.x} s={14}/></button>
    </div>
  </div>
</div></div>

<div style={{maxWidth:1320,margin:"0 auto",padding:"24px 24px 60px"}}>

{/* ═══════ LIST VIEW ═══════ */}
{view==="list"&&<div style={{animation:"fadeUp .35s ease"}}>
  <div style={{display:"flex",gap:14,marginBottom:22,flexWrap:"wrap"}}>
    {[["Total",stats.total,"#6366f1"],["Blog",stats.blog,"#0d9488"],["Top Stories",stats.top,"#f59e0b"],["Press",stats.press,"#8b5cf6"]].map(([l,v,c])=>(
      <div key={l} style={{background:"#111827",border:"1px solid #1e293b",borderRadius:10,padding:"16px 22px",borderTop:`3px solid ${c}`,flex:1,minWidth:130}}>
        <div style={{fontSize:11,fontWeight:600,color:"#64748b",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>
        <div style={{fontSize:30,fontWeight:800,color:"#f1f5f9",marginTop:2}}>{v}</div>
      </div>))}
  </div>
  <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
    <div style={{position:"relative",flex:1,minWidth:180}}>
      <input style={{...inp,paddingLeft:36}} placeholder="Search posts..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <div style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#475569"}}><I d={ic.search} s={15}/></div>
    </div>
    <select style={{...inp,width:"auto",minWidth:140,cursor:"pointer"}} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
      <option value="all">All Categories</option>
      {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
    </select>
    {["all","draft","published"].map(f=>(<button key={f} onClick={()=>setFilter(f)} style={{padding:"8px 14px",borderRadius:7,border:"1px solid",fontSize:12,fontWeight:600,cursor:"pointer",textTransform:"capitalize",background:filter===f?"#0d948818":"transparent",borderColor:filter===f?"#0d9488":"#1e293b",color:filter===f?"#2dd4bf":"#64748b"}}>{f}</button>))}
  </div>
  <div style={{background:"#111827",border:"1px solid #1e293b",borderRadius:12,overflow:"auto"}}>
    {!fsConnected?<div style={{padding:"60px 20px",textAlign:"center"}}>
      <div style={{width:48,height:48,borderRadius:12,background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><I d={ic.db} s={24} c="#64748b"/></div>
      <h3 style={{color:"#e2e8f0",margin:"0 0 8px",fontSize:17}}>Connecting to Firestore…</h3>
      <p style={{color:"#64748b",fontSize:14,margin:"0 0 20px",maxWidth:360,marginLeft:"auto",marginRight:"auto"}}>{fsStatus||"Using config from .env"}</p>
    </div>
    :loading?<div style={{padding:60,textAlign:"center",color:"#64748b"}}>Loading...</div>
    :shown.length===0?<div style={{padding:60,textAlign:"center"}}><p style={{color:"#94a3b8",fontSize:15,margin:0}}>No posts found</p></div>
    :<table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr>{["Title","Category","Status","Featured","Image","Date",""].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".6px",borderBottom:"1px solid #1e293b"}}>{h}</th>)}</tr></thead>
      <tbody>{shown.map(b=>{const bcat=getCategory(b.category);return(<tr key={b.id} style={{cursor:"pointer"}} onClick={()=>openEdit(b)}>
        <td style={{padding:"13px 16px",borderBottom:"1px solid #1e293b10",maxWidth:300}}>
          <div style={{fontWeight:600,color:"#f1f5f9",fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.title||"Untitled"}</div>
          <div style={{fontSize:11,color:"#475569",marginTop:2}}>/{b.slug||"no-slug"}</div>
        </td>
        <td style={{padding:"13px 16px",borderBottom:"1px solid #1e293b10"}}>
          <span style={{display:"inline-block",padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".4px",background:bcat.bg,color:bcat.color,border:`1px solid ${bcat.color}40`}}>{bcat.label}</span>
        </td>
        <td style={{padding:"13px 16px",borderBottom:"1px solid #1e293b10"}}>
          <span style={{display:"inline-block",padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700,textTransform:"uppercase",background:b.active?"#052e16":"#422006",color:b.active?"#4ade80":"#fbbf24"}}>{b.active?"published":"draft"}</span>
        </td>
        <td style={{padding:"13px 16px",borderBottom:"1px solid #1e293b10"}}>
          {b.isFeatured?<I d={ic.star} s={16} c="#f59e0b"/>:<span style={{color:"#334155"}}>—</span>}
        </td>
        <td style={{padding:"8px 16px",borderBottom:"1px solid #1e293b10"}}>
          {b.imgUrl?<img src={fullImgUrl(b.imgUrl)} style={{width:48,height:48,borderRadius:6,objectFit:"cover",border:"1px solid #1e293b"}} alt="" onError={e=>{e.target.style.display="none";}}/>:<span style={{color:"#475569",fontSize:11}}>—</span>}
        </td>
        <td style={{padding:"13px 16px",borderBottom:"1px solid #1e293b10",color:"#475569",fontSize:12}}>{b.date?new Date(b.date).toLocaleDateString():"—"}</td>
        <td style={{padding:"13px 16px",borderBottom:"1px solid #1e293b10",textAlign:"right"}} onClick={e=>e.stopPropagation()}>
          <button style={{background:"none",border:"none",color:"#0d9488",cursor:"pointer",padding:5}} onClick={()=>openEdit(b)}><I d={ic.edit} s={15}/></button>
          <button style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:5}} onClick={()=>setDelModal(b.id)}><I d={ic.trash} s={15}/></button>
        </td>
      </tr>);})}</tbody>
    </table>}
  </div>
</div>}

{/* ═══════ EDITOR VIEW ═══════ */}
{view==="editor"&&<div style={{animation:"fadeUp .3s ease"}}>
  {/* Top bar */}
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,flexWrap:"wrap",gap:10}}>
    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <h2 style={{margin:0,fontSize:18,fontWeight:700,color:"#f1f5f9"}}>{editId?"Edit Post":"New Post"}</h2>
      <span style={{padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".4px",background:currentCat.bg,color:currentCat.color,border:`1px solid ${currentCat.color}40`}}>{currentCat.label}</span>
      <span style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,textTransform:"uppercase",background:post.status==="published"?"#052e16":"#422006",color:post.status==="published"?"#4ade80":"#fbbf24"}}>{post.status}</span>
      {post.isFeatured&&<span style={{padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:700,textTransform:"uppercase",background:"#f59e0b20",color:"#f59e0b",border:"1px solid #f59e0b40",display:"inline-flex",alignItems:"center",gap:4}}><I d={ic.star} s={11}/>Featured</span>}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button style={{padding:"9px 18px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6}} onClick={()=>saveBlog("draft")} disabled={saving}><I d={ic.save} s={14}/>{saving?"Saving...":"Save Draft"}</button>
      <button style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0d9488",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6,opacity:saving?.6:1}} onClick={()=>saveBlog("published")} disabled={saving}><I d={ic.send} s={14}/>{post.status==="published"?"Update":"Publish"}</button>
    </div>
  </div>

  {/* Title + Slug */}
  <div style={{display:"flex",gap:14,marginBottom:18,flexWrap:"wrap"}}>
    <div style={{flex:2,minWidth:200}}><label style={lbl}>Title *</label>
      <input style={{...inp,fontSize:17,fontWeight:700,padding:"13px 14px",color:"#f1f5f9"}} placeholder="Your blog post title..." value={post.title}
        onChange={e=>{const t=e.target.value;setPost(p=>({...p,title:t,slug:p.slug?p.slug:toSlug(t)}));}}
        onBlur={()=>{if(!post.slug&&post.title)setPost(p=>({...p,slug:toSlug(p.title)}));}}/>
    </div>
    <div style={{flex:1,minWidth:180}}><label style={lbl}>Slug (link) *</label>
      <div style={{display:"flex",gap:6}}>
        <input style={inp} placeholder="auto-slug" value={post.slug} onChange={e=>setPost(p=>({...p,slug:e.target.value}))}/>
        <button style={{padding:"8px 12px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}} onClick={()=>setPost(p=>({...p,slug:toSlug(p.title)}))}>↻</button>
      </div>
    </div>
  </div>

  {/* Category */}
  <div style={{marginBottom:18}}>
    <label style={lbl}>Category *</label>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      {CATEGORIES.map(c=>(
        <button key={c.value} onClick={()=>setPost(p=>({...p,category:c.value}))}
          style={{padding:"10px 20px",borderRadius:8,border:"2px solid",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:".3px",
            background:post.category===c.value?c.bg:"transparent",
            borderColor:post.category===c.value?c.color:"#1e293b",
            color:post.category===c.value?c.color:"#64748b",
            flex:"1 1 auto",minWidth:120,textAlign:"center"
          }}>
          {c.label}
        </button>
      ))}
    </div>
  </div>

  {/* Featured toggle */}
  <div style={{marginBottom:18,padding:"14px 18px",background:"#111827",border:"1px solid #1e293b",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
    <div>
      <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9",display:"flex",alignItems:"center",gap:8}}><I d={ic.star} s={14} c={post.isFeatured?"#f59e0b":"#475569"}/>Featured post</div>
      <div style={{fontSize:11,color:"#64748b",marginTop:3}}>Featured posts appear in the hero section on cireta.com/insights</div>
    </div>
    <button onClick={()=>setPost(p=>({...p,isFeatured:!p.isFeatured}))}
      style={{width:44,height:24,borderRadius:12,border:"none",background:post.isFeatured?"#f59e0b":"#334155",position:"relative",cursor:"pointer",transition:"background .2s"}}>
      <span style={{position:"absolute",top:2,left:post.isFeatured?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
    </button>
  </div>

  {/* Image (manual path + preview) */}
  <div style={{background:"#111827",border:"1px solid #1e293b",borderRadius:10,marginBottom:18,padding:"18px 20px"}}>
    <label style={lbl}>Image Path <span style={{fontWeight:400,textTransform:"none",color:"#475569"}}>(relative to cdn.cireta.com/cireta-home/)</span></label>
    <input style={{...inp,fontFamily:"'JetBrains Mono',monospace",fontSize:13}} placeholder="insights/my-blog-slug.webp" value={post.imgUrl} onChange={e=>setPost(p=>({...p,imgUrl:e.target.value}))}/>
    <div style={{fontSize:11,color:"#475569",marginTop:6,lineHeight:1.5}}>
      Upload image to GCS bucket <code style={{color:"#64748b"}}>cdn.cireta.com/cireta-home/insights/</code>, then paste the relative path. Full URL: <span style={{color:"#64748b",wordBreak:"break-all"}}>{imgUrl||"(not set)"}</span>
    </div>
    {imgUrl&&<div style={{marginTop:14,borderRadius:10,overflow:"hidden",border:"1px solid #1e293b",background:"#0a0f1e",maxWidth:420}}>
      <div style={{aspectRatio:"1592/896"}}>
        <img src={imgUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="preview" onError={e=>{e.target.style.display="none";}}/>
      </div>
    </div>}
  </div>

  {/* Excerpt */}
  <div style={{marginBottom:18}}><label style={lbl}>Excerpt (paragraph) — shown on cards</label>
    <textarea style={{...inp,fontFamily:"'DM Sans',sans-serif",minHeight:60,resize:"vertical"}} placeholder="Brief description for the listing card..." rows={2} value={post.excerpt} onChange={e=>setPost(p=>({...p,excerpt:e.target.value}))}/>
  </div>

  {/* CONTENT EDITOR */}
  <div style={{marginBottom:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
      <label style={{...lbl,margin:0}}>Content *</label>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {["markdown","html","text"].map(m=>(<button key={m} onClick={()=>setFmt(m)} style={{padding:"4px 12px",borderRadius:5,border:"1px solid",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",background:fmt===m?"#0d948820":"transparent",borderColor:fmt===m?"#0d9488":"#1e293b",color:fmt===m?"#2dd4bf":"#475569"}}>{m}</button>))}
        <div style={{width:1,background:"#1e293b",margin:"0 4px"}}/>
        {[["editor","Edit"],["split","Split"],["preview","Preview"]].map(([k,l])=>(<button key={k} onClick={()=>setPane(k)} style={{padding:"4px 12px",borderRadius:5,border:"1px solid",fontSize:11,fontWeight:700,cursor:"pointer",background:pane===k?"#1e293b":"transparent",borderColor:pane===k?"#334155":"#1e293b",color:pane===k?"#e2e8f0":"#475569"}}>{l}</button>))}
      </div>
    </div>
    {fmt==="markdown"&&pane!=="preview"&&<div style={{display:"flex",gap:1,padding:"7px 10px",background:"#111827",borderRadius:"8px 8px 0 0",border:"1px solid #1e293b",borderBottom:"none",flexWrap:"wrap"}}>
      {[["B",ic.bold,()=>ins("**","**")],["I",ic.italic,()=>ins("*","*")],["H2",ic.h2,()=>ins("## ")],["UL",ic.list,()=>ins("- ")],["Link",ic.link,()=>ins("[","](url)")],["Img",ic.img,()=>ins("![alt](",")")],["Code",ic.code,()=>ins("```\n","\n```")],["Q",ic.quote,()=>ins("> ")]].map(([t,d,fn])=>(
        <button key={t} onClick={fn} title={t} style={{padding:"5px 9px",background:"transparent",border:"none",color:"#64748b",cursor:"pointer",borderRadius:5,display:"flex",alignItems:"center"}}><I d={d} s={15}/></button>))}
    </div>}
    <div style={{display:"flex",border:"1px solid #1e293b",borderRadius:fmt==="markdown"&&pane!=="preview"?"0 0 8px 8px":"8px",overflow:"hidden",minHeight:420}}>
      {pane!=="preview"&&<div style={{flex:1,display:"flex",flexDirection:"column"}}>
        <textarea ref={taRef} style={{width:"100%",flex:1,padding:"14px 16px",border:"none",background:"#0a0f1e",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:fmt==="text"?"'DM Sans',sans-serif":"'JetBrains Mono',monospace",resize:"none",lineHeight:1.7,minHeight:420}}
          placeholder={fmt==="markdown"?"# Your heading\n\nWrite in **Markdown**...":fmt==="html"?"<h2>HTML content</h2>":"Plain text..."} value={post.content} onChange={e=>setPost(p=>({...p,content:e.target.value}))}/>
      </div>}
      {pane!=="editor"&&<div style={{flex:1,borderLeft:pane==="split"?"1px solid #1e293b":"none",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"6px 14px",background:"#111827",fontSize:10,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".6px",borderBottom:"1px solid #1e293b"}}>Preview</div>
        {fmt==="html"
          ?<iframe title="preview" srcDoc={post.content} style={{flex:1,border:"none",background:"#fff",minHeight:420}}/>
          :<div className="pp" style={{padding:22,background:"#0a0f1e",flex:1,overflow:"auto",fontSize:15,color:"#cbd5e1",lineHeight:1.8}} dangerouslySetInnerHTML={{__html:preview()}}/>}
      </div>}
    </div>
  </div>

  {/* Author / Tags / Read Time */}
  <div style={{display:"flex",gap:14,marginBottom:14,flexWrap:"wrap"}}>
    <div style={{flex:1,minWidth:180}}><label style={lbl}>Author</label><input style={inp} value={post.author} onChange={e=>setPost(p=>({...p,author:e.target.value}))}/></div>
    <div style={{flex:2,minWidth:200}}><label style={lbl}>Tags (comma-separated)</label><input style={inp} placeholder="rwa, tokenization, gold" value={Array.isArray(post.tags)?post.tags.join(", "):post.tags} onChange={e=>setPost(p=>({...p,tags:e.target.value}))}/></div>
    <div style={{flex:1,minWidth:140}}><label style={lbl}>Read Time</label><input style={inp} placeholder="5 min read" value={post.readTime} onChange={e=>setPost(p=>({...p,readTime:e.target.value}))}/></div>
  </div>
  <div style={{marginBottom:18}}><label style={lbl}>Author Description</label>
    <textarea style={{...inp,fontFamily:"'DM Sans',sans-serif",minHeight:46,resize:"vertical"}} placeholder="Brief bio..." rows={2} value={post.authorDescription} onChange={e=>setPost(p=>({...p,authorDescription:e.target.value}))}/>
  </div>

  {/* SEO */}
  <div style={{background:"#111827",border:"1px solid #1e293b",borderRadius:10,marginBottom:14,overflow:"hidden"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",cursor:"pointer",userSelect:"none"}} onClick={()=>setSeoOpen(!seoOpen)}>
      <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>SEO, Open Graph & Canonical <span style={{fontWeight:400,color:"#64748b",fontSize:12}}>(stored for future use — public site currently reads meta from content HTML)</span></span>
      <span style={{color:"#475569",transform:seoOpen?"rotate(180deg)":"none",transition:"transform .2s"}}><I d={ic.chev} s={17}/></span>
    </div>
    {seoOpen&&<div style={{padding:"0 20px 20px"}}>
      <div style={{display:"flex",gap:14,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200}}><label style={lbl}>SEO Title</label><input style={{...inp,background:"#0a0f1e"}} placeholder={post.title||""} value={post.seoTitle} onChange={e=>setPost(p=>({...p,seoTitle:e.target.value}))}/><div style={{fontSize:11,color:(post.seoTitle||post.title||"").length>60?"#f87171":"#475569",marginTop:3}}>{(post.seoTitle||post.title||"").length}/60</div></div>
        <div style={{flex:1,minWidth:200}}><label style={lbl}>OG Image URL</label><input style={{...inp,background:"#0a0f1e"}} placeholder={imgUrl||""} value={post.ogImage} onChange={e=>setPost(p=>({...p,ogImage:e.target.value}))}/></div>
      </div>
      <div style={{marginBottom:16}}><label style={lbl}>SEO Description</label>
        <textarea style={{...inp,background:"#0a0f1e",fontFamily:"'DM Sans',sans-serif",minHeight:50,resize:"vertical"}} placeholder={post.excerpt||""} rows={2} value={post.seoDescription} onChange={e=>setPost(p=>({...p,seoDescription:e.target.value}))}/>
        <div style={{fontSize:11,color:(post.seoDescription||post.excerpt||"").length>160?"#f87171":"#475569",marginTop:3}}>{(post.seoDescription||post.excerpt||"").length}/160</div>
      </div>
      <div style={{marginBottom:16,padding:14,background:"#080e1e",borderRadius:8,border:"1px solid #1e293b"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
          <I d={ic.globe} s={14} c="#475569"/>
          <label style={{...lbl,margin:0,color:"#94a3b8"}}>Canonical URL</label>
        </div>
        <input style={{...inp,background:"#0a0f1e"}} placeholder={defaultCanonical} value={post.canonicalUrl} onChange={e=>setPost(p=>({...p,canonicalUrl:e.target.value}))}/>
        <div style={{fontSize:11,color:"#475569",marginTop:6,lineHeight:1.5}}>Leave blank to default: <span style={{color:"#64748b",fontFamily:"'JetBrains Mono',monospace"}}>{defaultCanonical}</span></div>
      </div>
      <div style={{padding:16,background:"#080e1e",borderRadius:8,border:"1px solid #1e293b"}}>
        <div style={{fontSize:10,fontWeight:700,color:"#475569",marginBottom:8,textTransform:"uppercase"}}>SERP Preview</div>
        <div style={{fontSize:12,color:"#8ab4f8",fontFamily:"Arial,sans-serif",marginBottom:1}}>
          {post.canonicalUrl ? post.canonicalUrl.replace(/^https?:\/\//,"").replace(/\//g," › ") : `cireta.com › insights › ${post.slug||"slug"}`}
        </div>
        <div style={{fontSize:17,color:"#8ab4f8",fontFamily:"Arial,sans-serif",marginBottom:3,lineHeight:1.3}}>{post.seoTitle||post.title||"Title"}</div>
        <div style={{fontSize:13,color:"#bdc1c6",fontFamily:"Arial,sans-serif",lineHeight:1.5}}>{post.seoDescription||post.excerpt||"Description..."}</div>
      </div>
    </div>}
  </div>

  {/* FAQ */}
  <div style={{background:"#111827",border:"1px solid #1e293b",borderRadius:10,marginBottom:14,overflow:"hidden"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",cursor:"pointer",userSelect:"none"}} onClick={()=>setFaqOpen(!faqOpen)}>
      <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>FAQ Items <span style={{fontWeight:400,color:"#64748b",fontSize:12}}>(AEO — Answer Engine Optimization)</span></span>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {(post.faqItems||[]).length>0&&<span style={{fontSize:11,color:"#2dd4bf",fontWeight:600}}>{post.faqItems.length}</span>}
        <span style={{color:"#475569",transform:faqOpen?"rotate(180deg)":"none",transition:"transform .2s"}}><I d={ic.chev} s={17}/></span>
      </div>
    </div>
    {faqOpen&&<div style={{padding:"0 20px 20px"}}>
      {(post.faqItems||[]).map((f,i)=>(<div key={i} style={{marginBottom:12,padding:14,background:"#0a0f1e",borderRadius:8,border:"1px solid #1e293b"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:11,fontWeight:700,color:"#475569"}}>Q{i+1}</span>
          <button style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:3}} onClick={()=>{const items=[...(post.faqItems||[])];items.splice(i,1);setPost(p=>({...p,faqItems:items}));}}><I d={ic.x} s={14}/></button>
        </div>
        <input style={{...inp,background:"#0f172a",fontSize:13,marginBottom:6}} placeholder="Question" value={f.question} onChange={e=>{const items=[...(post.faqItems||[])];items[i]={...items[i],question:e.target.value};setPost(p=>({...p,faqItems:items}));}}/>
        <textarea style={{...inp,background:"#0f172a",fontSize:13,fontFamily:"'DM Sans',sans-serif",minHeight:42,resize:"vertical"}} placeholder="Answer" rows={2} value={f.answer} onChange={e=>{const items=[...(post.faqItems||[])];items[i]={...items[i],answer:e.target.value};setPost(p=>({...p,faqItems:items}));}}/>
      </div>))}
      <button style={{padding:"8px 16px",borderRadius:7,border:"1px dashed #334155",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}} onClick={()=>setPost(p=>({...p,faqItems:[...(p.faqItems||[]),{question:"",answer:""}]}))}><I d={ic.plus} s={14}/>Add FAQ</button>
    </div>}
  </div>

  {/* Schema */}
  <div style={{background:"#111827",border:"1px solid #1e293b",borderRadius:10,marginBottom:40,overflow:"hidden"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",cursor:"pointer",userSelect:"none"}} onClick={()=>setSchemaOpen(!schemaOpen)}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>Generated JSON-LD Schemas</span>
        <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:"#052e16",color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:".3px"}}>Auto</span>
      </div>
      <span style={{color:"#475569",transform:schemaOpen?"rotate(180deg)":"none",transition:"transform .2s"}}><I d={ic.chev} s={17}/></span>
    </div>
    {schemaOpen&&<div style={{padding:"0 20px 20px"}}>
      <p style={{fontSize:12,color:"#475569",margin:"0 0 10px"}}>Auto-built from your inputs: BlogPosting + BreadcrumbList{(post.faqItems||[]).length>0?" + FAQPage":""}. Saved in <code style={{color:"#5eead4"}}>blog_detail.schemas</code>.</p>
      <pre style={{background:"#080e1e",padding:16,borderRadius:8,border:"1px solid #1e293b",color:"#5eead4",fontSize:11,fontFamily:"'JetBrains Mono',monospace",overflow:"auto",maxHeight:350,lineHeight:1.6,whiteSpace:"pre-wrap",margin:"0 0 10px"}}>{JSON.stringify(buildSchemas(post),null,2)}</pre>
      <button style={{padding:"7px 16px",borderRadius:7,border:"1px solid #334155",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}} onClick={()=>{navigator.clipboard.writeText(JSON.stringify(buildSchemas(post),null,2));flash("Copied");}}><I d={ic.copy} s={14}/>Copy</button>
    </div>}
  </div>
</div>}

</div></div>);
}

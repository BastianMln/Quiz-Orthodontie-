function arrowDefs(id, cls){return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="${cls}"/></marker></defs>`;}

const SCHEMAS = {
facemask(){ return `<svg viewBox="0 0 400 230" role="img" aria-label="Vecteurs du masque facial">
${arrowDefs("a1","f-acc")}${arrowDefs("a2","f-bad")}
<text x="12" y="20" class="t-mute">postérieur</text><text x="336" y="20" class="t-mute">antérieur →</text>
<line x1="20" y1="132" x2="380" y2="132" class="s-mute" stroke-dasharray="4 4"/>
<text x="24" y="148" class="t-mute">plan d'occlusion</text>
<path d="M70,78 C110,58 200,56 250,70 C268,76 272,104 262,126 L90,126 C74,118 64,96 70,78 Z" class="f-accs s-acc" stroke-width="1.5"/>
<text x="120" y="98" class="t-acc">maxillaire</text>
<circle cx="170" cy="84" r="4" class="f-acc"/><text x="178" y="80" class="t-mute">centre de résistance</text>
<circle cx="238" cy="124" r="4" class="f-surf s-ink" stroke-width="1.5"/>
<line x1="238" y1="124" x2="338" y2="166" class="s-acc" stroke-width="2.5" marker-end="url(#a1)"/>
<text x="250" y="186" class="t-acc">traction en bas et en avant</text>
<text x="250" y="201" class="t-mute">sous le plan d'occlusion · 800–1500 g</text>
<path d="M92,140 L250,140 C262,152 262,178 246,190 C200,206 140,206 110,196 C92,188 84,164 92,140 Z" class="f-sunk s-ink" stroke-width="1.2"/>
<text x="130" y="176" class="t-ink">mandibule</text>
<path d="M60,168 A40,40 0 0 0 86,212" class="s-bad" stroke-width="2" marker-end="url(#a2)"/>
<text x="10" y="226" class="t-bad">rotation horaire (effet indésirable)</text>
</svg>`;},

wires(){ return `<svg viewBox="0 0 400 240" role="img" aria-label="Courbes charge-flexion">
<line x1="50" y1="200" x2="380" y2="200" class="s-ink"/><line x1="50" y1="200" x2="50" y2="20" class="s-ink"/>
<text x="300" y="220" class="t-mute">flexion (activation)</text>
<text x="30" y="110" text-anchor="middle" class="t-mute" transform="rotate(-90 30 110)">charge délivrée</text>
<path d="M50,200 L110,50" class="s-ink" stroke-width="2.2"/>
<path d="M110,50 C120,38 140,32 175,30" class="s-ink" stroke-width="2.2" stroke-dasharray="5 3"/>
<circle cx="110" cy="50" r="4" class="f-bad"/>
<text x="118" y="64" class="t-bad">LP</text>
<text x="60" y="40" class="t-ink">acier</text>
<path d="M50,200 L96,150 C110,138 130,132 300,128 L330,126" class="s-acc" stroke-width="2.2"/>
<path d="M330,126 C320,160 310,168 120,172 C100,174 80,182 50,200" class="s-acc" stroke-width="1.6" stroke-dasharray="5 4"/>
<text x="200" y="120" class="t-acc">NiTi superélastique : plateau</text>
<text x="200" y="188" class="t-mute">décharge : force quasi constante</text>
<text x="60" y="110" class="t-mute">pente = rigidité</text>
<text x="60" y="124" class="t-mute">(module de Young)</text>
</svg>`;},

saos(){ return `<svg viewBox="0 0 420 300" role="img" aria-label="Arbre décisionnel TROS de type 1">
${arrowDefs("a3","f-acc")}
<rect x="110" y="10" width="200" height="38" rx="6" class="f-surf s-ink"/>
<text x="210" y="34" text-anchor="middle" class="t-ink">Suspicion de TROS type 1 → ORL</text>
<line x1="210" y1="48" x2="210" y2="70" class="s-acc" stroke-width="1.5" marker-end="url(#a3)"/>
<rect x="40" y="72" width="340" height="56" rx="6" class="f-accs s-acc"/>
<text x="210" y="94" text-anchor="middle" class="t-ink">Amygdales grade 3–4 (Brodsky) + ≥ 2 critères</text>
<text x="210" y="112" text-anchor="middle" class="t-ink">nocturnes majeurs + ≥ 2 ans, sans comorbidité ?</text>
<line x1="130" y1="128" x2="100" y2="160" class="s-acc" stroke-width="1.5" marker-end="url(#a3)"/>
<line x1="290" y1="128" x2="320" y2="160" class="s-acc" stroke-width="1.5" marker-end="url(#a3)"/>
<text x="92" y="148" class="t-acc">oui</text><text x="314" y="148" class="t-acc">non</text>
<rect x="10" y="162" width="190" height="56" rx="6" class="f-surf s-ink"/>
<text x="105" y="185" text-anchor="middle" class="t-ink">Adéno-amygdalectomie</text>
<text x="105" y="203" text-anchor="middle" class="t-mute">sans examen du sommeil</text>
<rect x="220" y="162" width="190" height="56" rx="6" class="f-surf s-ink"/>
<text x="315" y="185" text-anchor="middle" class="t-ink">Examen du sommeil</text>
<text x="315" y="203" text-anchor="middle" class="t-mute">IAHO : 2–5 léger · 5–10 modéré · ≥10 sévère</text>
<rect x="10" y="236" width="400" height="52" rx="6" class="f-sunk"/>
<text x="210" y="258" text-anchor="middle" class="t-ink">Dans tous les cas : ODF / rééducateur OMF si ventilation buccale,</text>
<text x="210" y="276" text-anchor="middle" class="t-ink">anomalie de l'articulé, praxies linguales ou posture anormale</text>
</svg>`;},

implant(){ return `<svg viewBox="0 0 400 170" role="img" aria-label="Espace minimal pour un implant d'incisive latérale">
<path d="M20,20 L70,20 L78,150 L30,150 Z" class="f-sunk s-ink"/><text x="22" y="165" class="t-mute">racine de 13</text>
<path d="M330,20 L380,20 L372,150 L322,150 Z" class="f-sunk s-ink"/><text x="316" y="165" class="t-mute">racine de 11</text>
<rect x="160" y="30" width="80" height="110" rx="10" class="f-accs s-acc" stroke-width="1.5"/>
<text x="200" y="90" text-anchor="middle" class="t-acc">implant</text>
<g class="s-ink"><line x1="80" y1="60" x2="160" y2="60"/><line x1="240" y1="60" x2="320" y2="60"/><line x1="160" y1="150" x2="240" y2="150"/></g>
<text x="120" y="52" text-anchor="middle" class="t-ink">≥ 1,5 mm</text>
<text x="280" y="52" text-anchor="middle" class="t-ink">≥ 1,5 mm</text>
<text x="200" y="165" text-anchor="middle" class="t-ink">≥ 3 mm</text>
<text x="200" y="16" text-anchor="middle" class="t-acc">total : au moins 6 mm mésio-distal</text>
</svg>`;},

cvm(){
  const stages=[
    {n:"CS1",shape:"trap",conc:[0,0,0],lab:"≥ 2 ans avant le pic"},
    {n:"CS2",shape:"trap",conc:[1,0,0],lab:"≈ 1 an avant"},
    {n:"CS3",shape:"hrect",conc:[1,1,0],lab:"pic ≈ 1 an après"},
    {n:"CS4",shape:"hrect",conc:[1,1,1],lab:"pic juste avant"},
    {n:"CS5",shape:"sq",conc:[1,1,1],lab:"≈ 1 an après"},
    {n:"CS6",shape:"vrect",conc:[1,1,1],lab:"≥ 2 ans après"}
  ];
  const W=68;let g="";
  stages.forEach((s,i)=>{
    const x0=14+i*W;
    // C2 (odontoide simplifiee)
    const c2b = s.conc[0] ? `Q${x0+22},88 ${x0},96` : `L${x0},96`;
    g+=`<path d="M${x0+8},40 L${x0+14},20 L${x0+30},20 L${x0+36},40 L${x0+44},48 L${x0+44},96 ${c2b} L${x0},48 Z" class="f-sunk s-ink"/>`;
    [1,2].forEach((k,j)=>{
      const top=110+j*52; let h=36,w=44,dx=0;
      if(s.shape==="trap"){h=28}
      if(s.shape==="hrect"){h=30}
      if(s.shape==="sq"){h=40;w=40;dx=2}
      if(s.shape==="vrect"){h=46;w=36;dx=4}
      const L=x0+dx,R=x0+dx+w,B=top+h;
      const T = s.shape==="trap" ? `M${L},${top+14} L${R},${top}` : `M${L},${top} L${R},${top}`;
      const bottom = s.conc[k] ? `Q${(L+R)/2},${B-8} ${L},${B}` : `L${L},${B}`;
      g+=`<path d="${T} L${R},${B} ${bottom} Z" class="f-sunk s-ink"/>`;
    });
    g+=`<text x="${x0+22}" y="236" text-anchor="middle" class="t-acc">${s.n}</text>`;
    g+=`<text x="${x0+22}" y="252" text-anchor="middle" class="t-mute" style="font-size:9.5px">${s.lab.split(" ").slice(0,3).join(" ")}</text>`;
    g+=`<text x="${x0+22}" y="264" text-anchor="middle" class="t-mute" style="font-size:9.5px">${s.lab.split(" ").slice(3).join(" ")}</text>`;
  });
  const px=14+3*W-12;
  return `<svg viewBox="0 0 420 272" role="img" aria-label="Stades CVM de Baccetti">
<line x1="${px}" y1="10" x2="${px}" y2="222" class="s-bad" stroke-dasharray="4 3" stroke-width="1.5"/>
<text x="${px+4}" y="14" class="t-bad">pic mandibulaire</text>
${g}
<text x="4" y="62" class="t-mute" style="font-size:9.5px">C2</text>
</svg>`;},

suture(){
  const st=["A","B","C","D","E"];let g="";
  st.forEach((s,i)=>{
    const x=12+i*82, cx=x+36;
    g+=`<path d="M${x+6},20 C${x+6},110 ${x+66},110 ${x+66},20" class="f-sunk s-mute"/>`;
    if(s==="A") g+=`<line x1="${cx}" y1="22" x2="${cx}" y2="92" class="s-ink" stroke-width="2"/>`;
    if(s==="B") g+=`<path d="M${cx},22 q4,6 0,12 q-4,6 0,12 q4,6 0,12 q-4,6 0,12 q4,6 0,12 q-4,5 0,10" class="s-ink" stroke-width="2"/>`;
    if(s==="C") g+=`<path d="M${cx-3},22 q3,6 0,12 q-3,6 0,12 q3,6 0,12 q-3,6 0,12 q3,6 0,12" class="s-ink" stroke-width="1.6"/><path d="M${cx+3},22 q3,6 0,12 q-3,6 0,12 q3,6 0,12 q-3,6 0,12 q3,6 0,12" class="s-ink" stroke-width="1.6"/>`;
    if(s==="D") g+=`<path d="M${cx-3},22 q3,6 0,12 q-3,6 0,12 q3,6 0,12" class="s-ink" stroke-width="1.6"/><path d="M${cx+3},22 q3,6 0,12 q-3,6 0,12 q3,6 0,12" class="s-ink" stroke-width="1.6"/><text x="${cx}" y="88" text-anchor="middle" class="t-mute" style="font-size:9px">fusion post.</text>`;
    if(s==="E") g+=`<text x="${cx}" y="62" text-anchor="middle" class="t-mute" style="font-size:9px">non visible</text>`;
    g+=`<text x="${cx}" y="128" text-anchor="middle" class="t-acc">Stade ${s}</text>`;
  });
  return `<svg viewBox="0 0 424 150" role="img" aria-label="Stades d'Angelieri">
<text x="4" y="12" class="t-mute" style="font-size:9.5px">antérieur ↑</text>${g}
<text x="212" y="146" text-anchor="middle" class="t-mute">A–C : suture non fusionnée · D–E : fusion (postérieure puis maxillaire)</text></svg>`;},

resorp(){ return `<svg viewBox="0 0 400 230" role="img" aria-label="Contraintes à l'apex selon le mouvement">
${arrowDefs("a4","f-acc")}
<g>
<path d="M60,40 C60,20 120,20 120,40 L118,90 C112,150 100,190 90,200 C80,190 68,150 62,90 Z" class="f-surf s-ink" stroke-width="1.4"/>
<line x1="90" y1="-2" x2="90" y2="28" class="s-acc" stroke-width="2.5" marker-end="url(#a4)"/>
<ellipse cx="90" cy="198" rx="22" ry="12" class="f-bads"/>
<path d="M60,40 C60,20 120,20 120,40 L118,90 C112,150 100,190 90,200 C80,190 68,150 62,90 Z" class="s-ink" stroke-width="1.4"/>
<circle cx="90" cy="200" r="4" class="f-bad"/>
<text x="90" y="222" text-anchor="middle" class="t-bad">ingression : pression concentrée à l'apex</text>
</g>
<g>
<path d="M260,40 C260,20 320,20 320,40 L318,90 C312,150 300,190 290,200 C280,190 268,150 262,90 Z" class="f-surf s-ink" stroke-width="1.4"/>
<rect x="322" y="60" width="10" height="130" rx="4" class="f-bads"/>
<line x1="240" y1="110" x2="270" y2="110" class="s-acc" stroke-width="2.5" marker-end="url(#a4)"/>
<text x="290" y="222" text-anchor="middle" class="t-acc">translation : pression répartie</text>
</g>
<text x="200" y="110" text-anchor="middle" class="t-mute">vs</text>
</svg>`;},

anb(){
  const N=[70,30], A=[250,130], B=[238,220];
  const P1=[30,168], P2=[380,196];
  function proj(p){const dx=P2[0]-P1[0],dy=P2[1]-P1[1];const t=((p[0]-P1[0])*dx+(p[1]-P1[1])*dy)/(dx*dx+dy*dy);return[P1[0]+t*dx,P1[1]+t*dy];}
  const Ao=proj(A),Bo=proj(B);
  const f=v=>v.toFixed(1);
  const R=70; const nrm=(p)=>{const dx=p[0]-N[0],dy=p[1]-N[1],l=Math.hypot(dx,dy);return[dx/l,dy/l]}; const ua=nrm(A), ub=nrm(B);
  return `<svg viewBox="0 0 400 260" role="img" aria-label="ANB et AO-BO">
<line x1="${P1[0]}" y1="${P1[1]}" x2="${P2[0]}" y2="${P2[1]}" class="s-mute" stroke-dasharray="5 4"/>
<text x="286" y="${P2[1]+16}" class="t-mute">plan d'occlusion</text>
<line x1="${N[0]}" y1="${N[1]}" x2="${A[0]}" y2="${A[1]}" class="s-ink" stroke-width="1.4"/>
<line x1="${N[0]}" y1="${N[1]}" x2="${B[0]}" y2="${B[1]}" class="s-ink" stroke-width="1.4"/>
<line x1="${A[0]}" y1="${A[1]}" x2="${f(Ao[0])}" y2="${f(Ao[1])}" class="s-acc" stroke-dasharray="3 3"/>
<line x1="${B[0]}" y1="${B[1]}" x2="${f(Bo[0])}" y2="${f(Bo[1])}" class="s-acc" stroke-dasharray="3 3"/>
<line x1="${f(Ao[0])}" y1="${f(Ao[1])}" x2="${f(Bo[0])}" y2="${f(Bo[1])}" class="s-acc" stroke-width="4"/>
<circle cx="${N[0]}" cy="${N[1]}" r="4" class="f-acc"/><text x="${N[0]-4}" y="${N[1]-8}" class="t-ink">N</text>
<circle cx="${A[0]}" cy="${A[1]}" r="4" class="f-acc"/><text x="${A[0]+8}" y="${A[1]+4}" class="t-ink">A</text>
<circle cx="${B[0]}" cy="${B[1]}" r="4" class="f-acc"/><text x="${B[0]+8}" y="${B[1]+4}" class="t-ink">B</text>
<text x="${f(Ao[0])}" y="${f(Ao[1]-8)}" class="t-acc">AO</text><text x="${f(Bo[0]-24)}" y="${f(Bo[1]+18)}" class="t-acc">BO</text>
<path d="M${f(N[0]+R*ua[0])},${f(N[1]+R*ua[1])} A${R},${R} 0 0 1 ${f(N[0]+R*ub[0])},${f(N[1]+R*ub[1])}" class="s-bad" stroke-width="2"/>
<text x="${f(N[0]+(R+10)*ua[0]-6)}" y="${f(N[1]+(R+10)*ua[1]+20)}" class="t-bad">ANB</text>
<text x="10" y="252" class="t-mute">L'ANB dépend de la position de N et de la rotation des bases ; l'AO-BO se lit sur le plan d'occlusion.</text>
</svg>`;}
};

/* ============================================================
   QUESTIONS — Série 01
   ============================================================ */

Object.assign(SCHEMAS, {
elastic(){ return `<svg viewBox="0 0 400 220" role="img" aria-label="Décomposition d'un élastique de classe II">
${arrowDefs("e1","f-acc")}${arrowDefs("e2","f-bad")}
<text x="10" y="18" class="t-mute">← antérieur</text>
<line x1="20" y1="100" x2="390" y2="100" class="s-mute" stroke-dasharray="5 4"/><text x="150" y="112" class="t-mute">plan d'occlusion</text>
<rect x="70" y="40" width="34" height="56" rx="8" class="f-surf s-ink"/><text x="62" y="34" class="t-ink">canine max.</text>
<rect x="276" y="104" width="54" height="46" rx="8" class="f-surf s-ink"/><text x="268" y="168" class="t-ink">1re molaire md.</text>
<line x1="98" y1="92" x2="286" y2="130" class="s-acc" stroke-width="3"/>
<line x1="286" y1="130" x2="236" y2="130" class="s-acc" stroke-width="2" marker-end="url(#e1)"/>
<line x1="286" y1="130" x2="286" y2="116" class="s-bad" stroke-width="2" marker-end="url(#e2)"/>
<text x="196" y="148" class="t-acc">≈ 97 % : mésialise</text>
<text x="300" y="116" class="t-bad" style="font-size:11px">≈ 26 % : égresse</text>
<line x1="98" y1="92" x2="148" y2="92" class="s-acc" stroke-width="2" marker-end="url(#e1)"/>
<line x1="98" y1="92" x2="98" y2="106" class="s-bad" stroke-width="2" marker-end="url(#e2)"/>
<text x="130" y="84" class="t-acc">distale</text><text x="104" y="120" class="t-bad" style="font-size:11px">égresse</text>
<text x="20" y="190" class="t-bad">→ bascule horaire du plan d'occlusion</text>
<text x="20" y="210" class="t-mute">angle ≈ 15° : cos 15° ≈ 0,97 · sin 15° ≈ 0,26</text>
</svg>`;},

moves(){
  const tooth=(x,cls="f-surf s-ink")=>`<path d="M${x-18},20 C${x-18},6 ${x+18},6 ${x+18},20 L${x+16},60 C${x+12},110 ${x+5},138 ${x},146 C${x-5},138 ${x-12},110 ${x-16},60 Z" class="${cls}" stroke-width="1.3"/>`;
  const cr=(x)=>`<circle cx="${x}" cy="70" r="3.5" class="f-acc"/>`;
  const rot=(x,y)=>`<g><circle cx="${x}" cy="${y}" r="6" class="f-bads s-bad" stroke-width="1.5"/><line x1="${x-4}" y1="${y}" x2="${x+4}" y2="${y}" class="s-bad" stroke-width="1.5"/><line x1="${x}" y1="${y-4}" x2="${x}" y2="${y+4}" class="s-bad" stroke-width="1.5"/></g>`;
  return `<svg viewBox="0 0 420 210" role="img" aria-label="Position du centre de rotation selon le mouvement">
${tooth(50)}${cr(50)}${rot(50,98)}
${tooth(150)}${cr(150)}${rot(150,146)}
${tooth(250)}${cr(250)}<text x="250" y="170" text-anchor="middle" class="t-bad">∞</text>
${tooth(350)}${cr(350)}${rot(350,8)}
<text x="50" y="184" text-anchor="middle" class="t-ink">version</text><text x="50" y="198" text-anchor="middle" class="t-mute">incontrôlée</text>
<text x="150" y="184" text-anchor="middle" class="t-ink">version</text><text x="150" y="198" text-anchor="middle" class="t-mute">contrôlée (apex)</text>
<text x="250" y="184" text-anchor="middle" class="t-ink">translation</text><text x="250" y="198" text-anchor="middle" class="t-mute">(à l'infini)</text>
<text x="350" y="184" text-anchor="middle" class="t-ink">torque</text><text x="350" y="198" text-anchor="middle" class="t-mute">(bord libre)</text>
<circle cx="12" cy="206" r="0" />
</svg>`;},

bowing(){ return `<svg viewBox="0 0 420 200" role="img" aria-label="Effet bowing vertical">
${arrowDefs("b1","f-acc")}${arrowDefs("b2","f-bad")}
<text x="10" y="16" class="t-mute">← antérieur</text>
<line x1="20" y1="70" x2="400" y2="70" class="s-mute" stroke-dasharray="5 4"/><text x="300" y="62" class="t-mute">arc au repos</text>
<path d="M20,64 Q150,110 400,70" class="s-bad" stroke-width="2.5"/><text x="120" y="120" class="t-bad">l'arc se cintre</text>
<rect x="30" y="60" width="26" height="70" rx="8" class="f-surf s-ink"/><text x="22" y="148" class="t-ink">incisives</text>
<line x1="43" y1="136" x2="43" y2="158" class="s-bad" stroke-width="2" marker-end="url(#b2)"/><text x="52" y="172" class="t-bad" style="font-size:11px">égression → supraclusion</text>
<g transform="rotate(14 190 90)"><rect x="176" y="60" width="28" height="70" rx="8" class="f-surf s-ink"/></g>
<text x="170" y="150" class="t-ink">canine : distoversion</text>
<line x1="260" y1="92" x2="212" y2="92" class="s-acc" stroke-width="2.5" marker-end="url(#b1)"/><text x="232" y="86" class="t-acc">rétraction</text>
<rect x="330" y="58" width="50" height="60" rx="8" class="f-surf s-ink"/><text x="330" y="136" class="t-ink">molaire</text>
<text x="10" y="192" class="t-mute">Plus l'arc est souple ou sous-dimensionné et la force élevée, plus le cintrage est marqué.</text>
</svg>`;},

canine(){ return `<svg viewBox="0 0 400 262" role="img" aria-label="Traction d'une canine palatine en coupe frontale">
${arrowDefs("c1","f-acc")}${arrowDefs("c2","f-bad")}
<text x="10" y="16" class="t-mute">coupe frontale · palais à droite</text>
<path d="M40,30 C40,150 90,200 150,210" class="s-mute" stroke-width="1.5"/><text x="20" y="226" class="t-mute">corticale vestibulaire</text>
<path d="M380,40 C330,120 300,170 260,210" class="s-mute" stroke-width="1.5"/><text x="300" y="226" class="t-mute">palais</text>
<g transform="rotate(-38 230 110)">
<path d="M212,60 C212,44 248,44 248,60 L246,110 C242,150 236,170 230,178 C224,170 218,150 214,110 Z" class="f-surf s-ink" stroke-width="1.4"/>
</g>
<circle cx="220" cy="118" r="4" class="f-acc"/><text x="186" y="112" class="t-acc">CR</text>
<circle cx="254" cy="160" r="4" class="f-ink s-ink"/>
<line x1="254" y1="160" x2="120" y2="186" class="s-acc" stroke-width="2.5" marker-end="url(#c1)"/>
<text x="60" y="176" class="t-acc">traction vers l'arc</text>
<path d="M276,86 A46,46 0 0 1 290,140" class="s-bad" stroke-width="2" marker-end="url(#c2)"/>
<text x="296" y="110" class="t-bad">racine part</text><text x="296" y="124" class="t-bad">en palatin</text>
<text x="10" y="246" class="t-mute">La force passe côté couronne du CR :</text>
<text x="10" y="260" class="t-mute">la couronne bascule, la racine reste palatine.</text>
</svg>`;},

binding(){ return `<svg viewBox="0 0 400 170" role="img" aria-label="Arc-boutement dans la gorge">
${arrowDefs("d1","f-acc")}
<rect x="120" y="50" width="160" height="70" rx="4" class="f-sunk s-ink"/>
<text x="126" y="44" class="t-mute">gorge de l'attache (vue de face)</text>
<g transform="rotate(-12 200 85)"><rect x="40" y="76" width="320" height="18" rx="3" class="f-accs s-acc" stroke-width="1.5"/></g>
<circle cx="126" cy="100" r="6" class="f-bad"/><circle cx="274" cy="68" r="6" class="f-bad"/>
<text x="60" y="140" class="t-bad">contacts d'arc-boutement</text>
<line x1="330" y1="150" x2="380" y2="150" class="s-acc" stroke-width="2.5" marker-end="url(#d1)"/>
<text x="250" y="164" class="t-acc">glissement voulu</text>
<text x="10" y="18" class="t-mute">Arc sous-dimensionné + dent qui bascule : le fil se coince dans les angles opposés.</text>
</svg>`;}
});


/* Desenhos vetoriais próprios, alinhados aos módulos do almoxarifado. */
(function(){
 const paths={
  overview:'<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
  orders:'<path d="M9 4h-2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m8 12 2 2 3-3M14.5 13H17M8 18h9"/>',
  vehicles:'<path d="M2 7h11v10H2zM13 10h4.5l3.5 4v3h-8zM16 10v4h5"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M4 5h7M2 20h2m4 0h7m4 0h3"/>',
  oil:'<path d="M5 7h12l2 3v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 1-2Z"/><path d="M8 7V4h5v3M4 11h-2M17 8l3-3 2 2-3 3"/><path d="M11 11c-1.4 2-2.2 3.2-2.2 4.4a2.2 2.2 0 0 0 4.4 0c0-1.2-.8-2.4-2.2-4.4Z"/>',
  tires:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8M18.4 5.6l-2.8 2.8m-7.2 7.2-2.8 2.8"/>',
  filters:'<path d="M3 4h18l-7 8v7l-4 2v-9z"/><path d="M6 7h12M8 10h8M10 14h4"/>',
  reports:'<path d="M3 3v18h18"/><rect x="6" y="12" width="3" height="6" rx=".6"/><rect x="11" y="8" width="3" height="10" rx=".6"/><rect x="16" y="5" width="3" height="13" rx=".6"/>',
  settings:'<path d="M9.6 3.5 10 2h4l.4 1.5 1.6.9 1.5-.5 2 3.4-1.1 1.1v1.8l1.1 1.1-2 3.4-1.5-.5-1.6.9L14 17h-4l-.4-1.9-1.6-.9-1.5.5-2-3.4 1.1-1.1V8.4L4.5 7.3l2-3.4 1.5.5z" transform="translate(0 2.5)"/><circle cx="12" cy="12" r="3"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>'
 };
 window.GGFIcons={html(name,extraClass=''){
  const safeClass=String(extraClass).replace(/[^a-zA-Z0-9 _-]/g,'');
  return `<svg class="context-icon ${safeClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.info}</svg>`;
 }};
 for(const button of document.querySelectorAll('.sidebar nav button[data-page]')){
  const path=paths[button.dataset.page];if(!path)continue;
  if(button.firstChild&&button.firstChild.nodeType===Node.TEXT_NODE)button.firstChild.textContent='';
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  icon.setAttribute('class','menu-svg-icon');
  icon.setAttribute('viewBox','0 0 24 24');
  icon.setAttribute('aria-hidden','true');
  icon.innerHTML=path;
  button.prepend(icon);
 }
})();

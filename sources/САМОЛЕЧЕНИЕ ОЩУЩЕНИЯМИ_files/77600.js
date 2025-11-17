/*************************
 mybb.ru, 
 Своя(или стандартная) иконка к теме; Ч1 в Начало HTML верх!
 2.08.2015; v1.00;
 Author: Deff
*************************/


(function (){
  if(ICONS1){
    var hW = ICONS1.image_maxLength;
    if(ICONS1.classic_correct)$('#pun-index').addClass('classic'); //Коррекции подвижки ссылок с Иконками на Главной для Стилей от Сервиса;
    if(typeof(hW)=="number")document.write('<style type="text/css">.MyTemaIcon:not(.behind){width:'+hW+'px;}.MyTemaIcon{max-width:'+hW+'px;}</style>');//Max-размер
  }
}());

ICONS1.ICON_Parse = function (){
  function getURLinCode(a){
      if(a.match(/^https?:\/\//)) return [a,'MyTemaIcon'];
      if(a.length==1&&ICONS1.icon_Image[a])return [ICONS1.icon_Image[a],'StTemaIcon '+a];
      if(a.length!=8||a.match(/[^0-9a-z]/i)||!a.match(/j|p|g$/)) return false;
      var b = {'j':'jpg','p':'png','g':'gif'}[a.slice(-1)];
      return [a.replace(/^(.{2})(.*)?.$/,'http://$1.uploads.ru/t/$2.'+b),'MyTemaIcon'];
  }
  var pun_index = $('#pun-index').length;
  var isForum = $('#pun-main .forum').length;    // 1 = Мы в форуме или в поиске по темам //
  var oN = (ICONS1.pun_indexOff + pun_index)!=2; //Отключение MyTemaIcon на Главной;
  var On2 = (ICONS1.pun_searchOff+$('#pun-searchtopics').length)!=2; //Отключение MyTemaIcon в Поиске по темам
  function setIcon (that,setST,setMy){
      setMy = On2*oN * setMy;
      var html = $(that).html(); if(html.indexOf('¤')==-1) return;  var arr = html.split(/\s*¤/);
      if(arr.length==3 && $.trim(arr[2])==''){
          var a = getURLinCode(arr[1]), dopClass = (a[1]=='MyTemaIcon' && ICONS1.front_or_behind?' behind':''),
          img = '<img class="'+a[1]+dopClass+'" src="'+a[0]+'" alt="'+a[1]+'"/>';
          if(a[1]){
            if(setST && a[1]!='MyTemaIcon'){$(that).html(arr[0]).addClass('addIcon').before(img);return;}
            if(setMy && a[1]=='MyTemaIcon'&&ICONS1.front_or_behind==0){$(that).addClass('addIcon').html(img+arr[0]);return;}
            if(setMy && a[1]=='MyTemaIcon'&&ICONS1.front_or_behind==1){
               var linkA = $(that).addClass('addIcon-B');
               /* Иконка сзади, тестим: "Иконка в .forum td?" */
               var TD = linkA.parents('td:first');
               if(isForum){linkA.html(arr[0]); TD.append('<a class="addIcon-B" href="'+that.href+'">'+img+'</a>'); return;}
	       else {linkA.html(arr[0]+img); return;}
            }
          }
      } if(arr.length>1)$(that).html(html.split(/\s*¤[^¤<>]*¤/).join(''));
  }

  var lnkTems = 'a[href*="viewtopic.php?"]';
  $('#pun-crumbs1>p,#pun-online tr>.tcl+.tcl '+lnkTems+',.post h3 '+lnkTems+',.post-content '+lnkTems+',#pun-crumbs2>p').each(function(){
      var html = $(this).html(); if(html.indexOf('¤')!=-1)$(this).html(html.split(/\s*¤[^¤<>]*¤/).join(''));
  });

  $('#pun-main h1:first>span').each(function(){setIcon (this,1,0);});
  
  function tstAndSetIcons(){
      if($('#pun-index,#pun-viewforum,#pun-searchtopics').length){
          $('#pun-index '+lnkTems+',#pun-main .forum td '+lnkTems).each(function(){ setIcon (this,1,1); });
          if(isForum)$(lnkTems).not('[class*="addIcon"]').each(function(){$(this).html($(this).html().split(/\s*¤[^¤<>]*¤/).join(''));});
      } else $('#pun '+lnkTems).each(function(){ setIcon (this,0,0); });
  } tstAndSetIcons();


  if ($("#pun-index").length){
      var t=0, time_func = setInterval(function(){ t++;
          if (t>60) { clearInterval(time_func); return; } 
          $('#pun td '+lnkTems).each(function(){ if($(this).html().split('¤').length==3){clearInterval(time_func); tstAndSetIcons();return false;};});
      },200);
  }

}
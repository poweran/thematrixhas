//==== ФУНКЦИЯ:ВОЗМОЖНОСТЬ РЕДАКТИРОВАНИЯ  СООБЩЕНИЯ ПО ВРЕМЕНИ V1.01.от 19.05.2011 ====//

	if(GroupID == 3)UserLogin = ' '; //Login гостя для кукисов

//END STARTING SETTING ----------//

//================= БИБЛИОТЕКА КУКИСОВ  ============== //

	// Библиотека для кукисов
function setCookie4(name, value, expires, path, domain, secure) {
	if (!name || !value) return false; //alert("HELLO>>"+value)
	var today = new Date();
	today.setTime( today.getTime() );
        var expires_date = new Date( today.getTime() + (expires) );

var str = encodeURIComponent(name) + '=' + encodeURIComponent(value);
	if (expires) str += '; expires=' + expires_date.toGMTString();
	if (path)    str += '; path=' + path;
	if (domain)  str += '; domain=' + domain;
	if (secure)  str += '; secure';
	
	document.cookie = str;
	return true;
}

function getCookie4(name) {
        name= encodeURIComponent(name)
	var pattern = "(?:; )?" + name + "=([^;]*);?";
	var regexp  = new RegExp(pattern,"mg");
	if (regexp.test(document.cookie))
	return decodeURIComponent(RegExp["$1"]);
	
	return false
}
function deleteCookie4( name, path, domain ) {

	if ( getCookie4( name ) ) name= encodeURIComponent(name);document.cookie = name + '=' +
			( ( path ) ? ';path=' + path : '') +
			( ( domain ) ? ';domain=' + domain : '' ) +
			';expires=Thu, 01-Jan-1970 00:00:01 GMT';
 }

function testNumLast(str, trp) {	    //test не цифры(или конца строки) за последней цифрой
    var s=str.lastIndexOf(trp);if(s!=-1){var s=str.substring(s+trp.length,s+trp.length+1);
    if (s.search(/\d/gi)==-1){return true}else {return false};}else {return false}

 }  	//End//Библиотека Кукисов

//===================================================================//

 	   //CБРОС ОГРАНИЧЕНИЙ ДЛЯ ВЫБРАННЫХ ГРУПП
function Without_limits(B) {for (i=0; i<B.length; i++){if(GroupID==B[i]){
$("#style-st1").replaceWith("");$("#style-st2").replaceWith("");//alert(B[i]);

return;};}};//###№### END:Cброс ОГРАНИЧЕНИЙ

//=========================== STARTFUNCTION ========================//
function Startfunction () {
	if(setTimeEdit>180)setTimeEdit=160;  //максимальное время редактирования в минутах
	//alert("setTimeEdit="+setTimeEdit+"мин.")
	var submitPST=''	//Была ли нажата клавиша submit-добавки сообщения;
	request_set_editing=0;	//Запрос функции в HTML низ "Установки редактирования поста";
	var NumPst; //Кол-во постов на предыдущий-текущий момент;

 if(UserLogin != ' '){

	//submitPST=getCookie4(UserLogin+'submitPST');	//пока отключили проверку на submit


//************** ВРЕМЕННЫЕ ТЕСТ-УСТАНОВКИ ********************//

//alert('submitPST > '+submitPST); //пока отключили
submitPST=1;//Test; //UserPosts = 7;//Test добавки Поста; //Для ТЕСТА ДОБАВЛЯЕМ ПОСТЫ по Одному

//**************************************************************//

	NumPst=getCookie4(UserLogin+'UserPosts');
  if(submitPST!=false){

	if(NumPst!=false){		//Вход не первый раз
	NumPst=parseFloat(NumPst);	//Переводим в цифру
	//alert("NumPst="+NumPst)		

	if(UserPosts>NumPst){		//Колво постов изменилось;

//=================================================================================//
//Устанавливаем Запрос для функции в HTML низ
	request_set_editing=1;

	}	//(UserPosts=<NumPst) 
	}	//if(NumPst==false){//Вход первый раз
   }	//(submitPST==false) //Клавиша submit-добавки сообщения нажата не была

   setCookie4(UserLogin+'UserPosts',UserPosts,365*24*60*60*1000);
 }
} //END: STARTFUNCTION

//==================FUNCTION SET_TIME_EDIT()===================================//
	function set_Time_Edit() {

if($(".punbb").attr("id")=="pun-viewtopic"){//Мы в Топике;

	URLa=document.URL; Id_Post=URLa.replace(/^.+=\d+(#p\d+)$/igm,"$1"); //alert("Id_Post >"+Id_Post)
	/*&p=28#p667860*//*=68#p458*/ 

	var AddNewPoststr=getCookie4('AddNewPosts');
	if(AddNewPoststr==false)AddNewPoststr='';

	//*********************************************************************************//
if(request_set_editing==1){ //alert("ЕСТЬ ЗАПРОС НА АНАЛИЗ ПОСТОВ В ТОПИКЕ")


	if(Id_Post!=''&& $(Id_Post).find("li.pa-author a").text()==UserLogin){
	//alert("Добавленный пост найден!")
	AddNewPoststr+=','+Id_Post;
	setCookie4('AddNewPosts',AddNewPoststr,setTimeEdit*60*1000+2*60*1000);
	setCookie4(Id_Post,1,setTimeEdit*60*1000);
	//alert("getCookie4('AddNewPosts')"+getCookie4('AddNewPosts'))

	}   //Указанный пост на странице не этого юзера(UserLogin)

}
	//*********************************************************************************//

  if(AddNewPoststr!= false && AddNewPoststr!=''){

	var virgule=",";
	var ListPOST = AddNewPoststr.split(virgule); //alert('ListPOST >'+ListPOST)

	  for (i=1; i < ListPOST.length; i++){ //alert('ListPOST[i]='+ListPOST[i])

	var postI=getCookie4(ListPOST[i]); //alert("AddNewPoststr "+AddNewPoststr)
  if(postI==false)AddNewPoststr=AddNewPoststr.replace(','+ListPOST[i],'');//alert(i +" "+ListPOST[i]+" postI >"+ postI);}
	  }

	  //Перезаписываем Лист постов без устаревших
    if(AddNewPoststr!=''){setCookie4('AddNewPosts',AddNewPoststr,setTimeEdit*60*1000+2*60*1000);
	ListPOSTnew=AddNewPoststr.split(virgule);
	//alert('ListPOSTnew='+ListPOSTnew)

	//Скрываем Посты не в Списке от редактирования

	$(".post  .pl-edit").addClass("hide_edit")
	for (i=1; i<ListPOSTnew.length; i++){
	$(ListPOSTnew[i]+" .pl-edit").removeClass("hide_edit");
	//alert("Открыли Пост="+ListPOSTnew[i])
	}
	$("#style-st1").replaceWith("")

     }else deleteCookie4('AddNewPosts')
  }
	//*********************************************************************************//

}	//Мы не на страницах Топика;
		//Мы пофиг где:
 request_set_editing=0; //Cброс запроса;
  //deleteCookie4(UserLogin+'submitPST');
	}//End:function setTimeEdit()

//=================//End:function setTimeEdit()========================================//

	Without_limits(Edit_NoLimit); //Сброс Ограничений для Выбранных групп
	Startfunction ();
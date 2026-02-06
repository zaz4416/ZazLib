
// Ver.1.0 : 2026/02/07

$.localize = true;  // OSの言語に合わせてローカライズする



// --- グローバル関数 -----------------------------------------------------------------

// アプリケーションのバージョンを取得
function appVersion() {
  var tmp = app.version.toString().split('.') ;
  var res = [] ;
  for(var i = 0, len = tmp.length ; i < len ; i++) {
    res.push(Number(tmp[i])) ;
  }
  return res ;
}

// --- 辞書から自動翻訳処理 (en以外が未定義の場合、enを引用する) ---
function GetWordsFromDictionary(obj) {
    var result = {}; // 1. 戻り値用の新しいオブジェクトを作成
    
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (typeof obj[key] === "object" && obj[key] !== null) {
                // 2. まず環境言語でlocalizeを試みる
                var translated = localize(obj[key]);
                
                // 3. 結果が空などの場合は en を強制引用し、新しいオブジェクトに格納
                result[key] = translated || obj[key].en || "";
            } else {
                // オブジェクトでない（既に文字列などの）場合もそのままコピー
                result[key] = obj[key];
            }
        }
    }
    return result; // 4. 翻訳済みの新しいオブジェクトを返す
}

function ClassInheritance(subClass, superClass) {
    // 1. 静的プロパティ・メソッドの継承 (親クラス自体のプロパティを子にコピー)
    for (var prop in superClass) {
        if (superClass.hasOwnProperty(prop)) {
            subClass[prop] = superClass[prop];
        }
    }

    // 2. プロトタイプチェーンの構築 (代理関数を使用)
    function Surrogate() {
        this.constructor = subClass;
    }
    Surrogate.prototype = superClass.prototype;
    subClass.prototype = new Surrogate();

    // 3. 親クラスへのショートカット（子クラスから親のメソッドを呼びやすくする）
    // 例: subClass.superClass.methodName.call(this)
    subClass.superClass = superClass.prototype;
}

// ---------------------------------------------------------------------------------



//-----------------------------------
// クラス CGlobalArray
//-----------------------------------

// 1. コンストラクタ定義
function CGlobalArray(Max) {
    var self = this;

    this.ObjectNo = -1;
    this.MAX_INSTANCES = Max;

    // 1. 実行中のスクリプト名を取得（拡張子なし）
    var scriptName = decodeURI(File($.fileName).name).replace(/\.[^\.]+$/, "");

     // 2. グローバルに格納するためのユニークなキー名を作成
    self.storageKey = "store_" + scriptName;
    self.indexKey   = "idx_" + scriptName;

    // 3. ブラケット記法 [] を使って、動的に $.global のプロパティにアクセス
    if (!($.global[self.storageKey] instanceof Array)) {
        $.global[self.storageKey] = [];
        $.global[self.indexKey  ] = 0;       // 次に書き込むインデックスを管理
    }
}

/**
 * オブジェクトのプロトタイプを継承しつつ、プロパティをコピーする（ES3互換）
 * @param {Object} obj - コピー元のインスタンス
 * @returns {Object} - 新しく生成されたクローン
 */
CGlobalArray.prototype.cloneInstance = function(obj) {
    if (obj === null || typeof obj !== "object") return obj;

    // 1. プロトタイプを継承した新しいオブジェクトを作成
    var F = function() {};
    F.prototype = obj.constructor ? obj.constructor.prototype : Object.prototype;
    var clone = new F();

    // 2. 自身のプロパティをコピー (Object.assignの代用)
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clone[key] = obj[key];
        }
    }
    return clone;
}


/**
 * $.global[self.storageKey] に、オブジェクトのクローンを登録する
 * @param {Object} newInst - インスタンス
 * @returns {数字} - 登録No(0〜)
 */
CGlobalArray.prototype.RegisterInstance = function(newInst) {
    var self = this;

    // newInstのプロパティに登録させたい値があれば、pushする前に、ここですること！！
    var idx = $.global[ self.indexKey ] ;

    // --- 上書き前の解放処理 ---
    if ($.global[self.storageKey] [idx]) {
        var oldInst = $.global[self.storageKey] [idx];
        
        // UI（ダイアログ）を閉じて破棄
        if (oldInst.m_Dialog) {
            try {
                oldInst.m_Dialog.close();
                oldInst.m_Dialog = null; 
            } catch(e) {
                $.writeln("Previous dialog close failed: " + e);
            }
        }
        
        // オブジェクトの全プロパティを削除して参照を切る
        for (var prop in oldInst) {
            if (oldInst.hasOwnProperty(prop)) {
                oldInst[prop] = null;
            }
        }
        $.global[self.storageKey] [idx] = null; // 明示的にnullを代入
    }

    // --- ガベージコレクションの実行 ---
    // 参照が切れたメモリを即座に回収対象にする
    $.gc(); 

    // クローンを作成する前に、設定が必要なプロパティに値を入れる
    newInst.m_ArrayOfObj.ObjectNo = idx;

    // クローンを作成して、指定した位置に代入（上書き）
    $.global[self.storageKey] [idx] = newInst.m_ArrayOfObj.cloneInstance(newInst);

    // 次の書き込み位置を更新（MAX_INSTANCES に達したら 0 に戻る）
    $.global[self.indexKey  ]  = (idx + 1) % self.MAX_INSTANCES;

    $.writeln("オブジェクト登録完了。No: " + newInst.m_ArrayOfObj.ObjectNo + " (次回の書き込み先: " + $.global[self.indexKey]  + ")");
    return newInst.m_ArrayOfObj.ObjectNo;;
}


/**
 * $.global[self.storageKey] への文字列を返します
 * @returns {文字列} - $.global[self.storageKey] への文字列
 */
CGlobalArray.prototype.GetGlobalClass = function() {
    var self = this;
    var name = "$.global['" + self.storageKey + "'][" + self.ObjectNo + "].";
    return name;
}


/**
 * 全てのインスタンスを一括で閉じるような操作も可能になります
 */
CGlobalArray.prototype.CloseAllInstances = function() {
    var self = this;

    if ( $.global[self.storageKey] .length > 0 ) {
        var instances = $.global[self.storageKey] ;
        for (var i = 0; i < instances.length; i++) {
            if (instances[i].m_Dialog) {
                instances[i].m_Dialog.close();
            }
        }
        $.global[self.storageKey]  = []; // 配列をリセット
    }
}


//----------------------------------------
//  ベースクラス CPaletteWindow
//----------------------------------------

 var _OriginalWindow = Window;
 // CPaletteWindowのコンストラクタをここで定義
 function CPaletteWindow( MaxInstance, ReSizeAble ) {
    $.writeln( "コンストラクタ_CPaletteWindow" );

    if ( ReSizeAble ) {
        // リサイズ可能なダイアログを生成
        this.m_Dialog = new Window( "palette", "", undefined, {resizeable: true} );
    }
    else{
        // リサイズ固定なダイアログを生成        
        this.m_Dialog = new Window( "palette", "", undefined, {resizeable: false} );
    }

    this.m_ArrayOfObj = new CGlobalArray( MaxInstance );

    // インスタンスのコンストラクタ（子クラス自身）の静的プロパティに保存することで、動的に静的プロパティを定義
    this.constructor.self = this;
}

// CPaletteWindowのメソッドをここで定義
//  ・ベースとしたいクラスに限り、下記のようにまとめてメソッドを記述しても良い。
//  ・サブクラスでは、個別にメソッドを記述すること。下記のようにまとめて記述してはいけない。
CPaletteWindow.prototype = {

    CallFuncInGlobalArray: function( FuncName ) {
        var self = this;
        var name = self.m_ArrayOfObj.GetGlobalClass() + FuncName;
        eval( name );  
    },

    CallFunc: function( FuncName ) {
        var self = this;
        if ( self.m_ArrayOfObj.ObjectNo >= 0 ) {
            var bt = new BridgeTalk;
            bt.target = BridgeTalk.appSpecifier;
            bt.body   = self.m_ArrayOfObj.GetGlobalClass() + FuncName + "();";
            bt.send();
        } else {
            alert("Undefine ObjectNo in CallFuncWithGlobalArray.");
        }
    },

    RegisterInstance: function() {
        var self = this;
        self.m_ArrayOfObj.RegisterInstance( self );
    },

    GetDlg: function() {
        return ( this.m_Dialog );
    },

    show: function() {
        var self = this;
        $.writeln( "ObjectNo is " + self.m_ArrayOfObj.ObjectNo + " in show()." );
        self.CallFuncInGlobalArray( "m_Dialog.show()" );
        $.writeln("ダイアログ表示");
    },

    close: function() {
        var self = this;
        self.m_Dialog.close();
        $.writeln("ダイアログ閉じた");
    },

    addEventListener: function( p1, p2 ) {
        var Dlg = this.GetDlg();
        return Dlg.addEventListener( p1, p2 );
    },

    AddPanel: function(Text) {
        var Dlg = this.GetDlg();
        var PanelText = Dlg.add( "panel") ;
        return PanelText;
    },

    AddRadioButton: function(Text) {
        var Dlg = this.GetDlg();
        var RadioButtonText = Dlg.add( "radiobutton") ;
        RadioButtonText.text = Text;
        return RadioButtonText;
    },

    AddEditText: function(Text) {
        var Dlg = this.GetDlg();
        var EdText = Dlg.add( "edittext") ;
        EdText.text = Text;
        return EdText;
    },

    AddStaticText: function(Text) {
        var Dlg = this.GetDlg();
        var StText = Dlg.add( "statictext") ;
        StText.text = Text;
        return StText;
    },

    AddButton: function(Text) {
        var Dlg = this.GetDlg();
        var Btn = Dlg.add( "button") ;
        Btn.text = Text;
        return Btn;
    },

    AddChkBox: function(Text, Value) {
        var Dlg = this.GetDlg();
        var ChkBox = Dlg.add("checkbox",undefined, "");
        ChkBox.text = Text;
        ChkBox.value = Value;
        return ChkBox;
    },

    LoadGUIfromJSX: function( GUI_JSX_Path ) {

        var self = this;

        // 1. 偽のコンストラクタ（既存のダイアログを返す）
        var FakeWindow = function() {
            $.writeln( "オーバーライドされたwindowを実行" );
            return self.m_Dialog;
        };
        // オリジナルのWindowプロトタイプを継承させておく（instanceof対策）
        FakeWindow.prototype = _OriginalWindow.prototype;

        // 2. 外部ファイルのコードを文字列として読み込む
        // ※ $.fileName を使うことで、このJSXファイルからの相対パスを正確に取得
        var currentPath = new File($.fileName).path;
        var guiFile = new File( GUI_JSX_Path) ;
        
        var guiCode = "";
        if (guiFile.open("r")) {
            guiCode = guiFile.read();
            guiFile.close();
        } else {
            alert("GUI定義ファイルが見つかりません: " + guiFile.fullName);
            return false;
        }

        // 3. 即時関数によるスコープの差し替え
        // 第1引数に FakeWindow を渡すことで、guiCode 内の "new Window" が
        // グローバルの Window ではなく、FakeWindow（= self.m_Dialog）を参照します
        (function(Window) {
            try {
                // 1. guiCode から "var 変数名" をすべて抜き出す（正規表現）
                var varNames = [];
                var match;
                // var の後ろにある単語を抽出する正規表現
                var regex = /var\s+([a-zA-Z0-9_]+)/g;
                while ((match = regex.exec(guiCode)) !== null) {
                    varNames.push(match[1]);
                }

                // 2. 変数を外に引き出すための「エクスポート用コード」を生成
                // eval の末尾で実行させ、定義された変数を return させる
                var exportSnippet = "\n; (function(){ \n var __result = {};";
                for (var i = 0; i < varNames.length; i++) {
                    var v = varNames[i];
                    // 変数が定義されている場合のみ、戻り値のオブジェクトに格納
                    exportSnippet += "if(typeof " + v + " !== 'undefined') __result['" + v + "'] = " + v + ";\n";
                }
                exportSnippet += "return __result; \n })();";

                // 3. 元のコードとエクスポートコードを合体させて eval を実行し、結果を受け取る
                var extractedVars = eval(guiCode + exportSnippet);

                // 4. 受け取った変数を一括で self (インスタンス) に紐付ける
                for (var key in extractedVars) {
                    if (extractedVars.hasOwnProperty(key)) {
                        // button1, group1 などが自動的に self に登録される
                        self[key] = extractedVars[key];
                        $.writeln("GUIプロパティ追加: " + key); // デバッグ用
                    }
                }

            } catch (e) {
                alert("GUI実行エラー: " + e.message);
                return false;
            }
        })(FakeWindow);

        return true;
    }

} // prototype


// Ver.1.0 : 2026/02/10

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
// クラス CControlIndex
//-----------------------------------

// 1. コンストラクタ定義
function CControlIndex(storageKey, Max) {
    var self = this;
    self.MAX_INSTANCES = Max;
    self.indexKey = "idx_"   + storageKey;

    // $.global[self.indexKey] が未定義の時にだけ、初期化
    if ( $.global[self.indexKey] === undefined ) {
        self.Init();
    }
}

// 初期化
CControlIndex.prototype.Init = function() {
    var self = this;
    $.global[self.indexKey] = [];
    for ( lp=self.MAX_INSTANCES-1; lp>=0; lp-- ) {
        $.global[self.indexKey].push(lp);
    }
}

// インデックスを得る
CControlIndex.prototype.GetIndex = function( Max ) {
    var self = this;
    var index = -1;

    // 配列が存在し、かつ中身がある間だけ実行
    if ( $.global[self.indexKey] !== undefined && $.global[self.indexKey].length > 0 ) {
        index = $.global[self.indexKey].pop();
    }

    return index;
}

// 登録可能か
CControlIndex.prototype.Is_it_possible_to_register = function() {
    var self = this;

    // 配列が存在し、かつ中身がある間だけ実行
    if ( $.global[self.indexKey] === undefined ) {
        return false;
    } else {
        if ( $.global[self.indexKey].length == 0 ) {
            return false;
        }
    }

    return true;
}

// インデックスが破棄された
CControlIndex.prototype.DeleteIndex = function( idx ) {
    var self = this;
    $.global[self.indexKey].push( idx );
}


//-----------------------------------
// クラス CGlobalArray
//-----------------------------------

// 1. コンストラクタ定義
function CGlobalArray(storageKey, maxCount) {
    var self = this;

    self.ArrayIndex = -1;
    self.MAX_INSTANCES = maxCount || 5;
    self.m_ControlIndex = new CControlIndex( storageKey, self.MAX_INSTANCES );

    // 1. グローバルに格納するためのユニークなキー名を作成
    self.storageKey = "store_" + storageKey;


    // 2. ブラケット記法 [] を使って、動的に $.global のプロパティにアクセス
    if (!($.global[self.storageKey] instanceof Array)) {
        $.writeln("$.global[self.storageKey] を新規に生成");
        self.m_ControlIndex.Init();
        $.global[self.storageKey] = [];
    } else {
        if ( $.global[self.storageKey].length > self.MAX_INSTANCES ) {
            // なんからの理由で、this.MAX_INSTANCES を超える登録があった場合は、強制的にメモリ解放させる
            $.writeln("$.global[self.storageKey] をすべて破棄して、新規に生成");
            self.CloseAllInstances();
            self.m_ControlIndex.Init();
            $.global[self.storageKey] = [];
        }
    }
}


CGlobalArray.prototype.Is_it_possible_to_register = function(obj) {
    var self = this;
    return self.m_ControlIndex.Is_it_possible_to_register();
}


/**
 * オブジェクトのプロトタイプを継承しつつ、プロパティをコピーする（ES3互換）
 * @param {Object} obj - コピー元のインスタンス
 * @returns {Object} - 新しく生成されたクローン
 */
CGlobalArray.prototype.cloneInstance = function(obj) {
    if (obj === null || typeof obj !== "object") return obj;

    var clone;
    // constructor が存在し、それが Object ではない場合（独自クラスの場合）
    if (obj.constructor && obj.constructor !== Object) {
        var F = function() {};
        F.prototype = obj.constructor.prototype;
        clone = new F();
        clone.constructor = obj.constructor; // constructorを復元
    } else {
        clone = {};
    }

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
    var idx = self.m_ControlIndex.GetIndex();

    if ( idx != -1 ) {
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
        newInst.m_ArrayOfObj.ArrayIndex = idx;

        // クローンを作成して、指定した位置に代入（上書き）
        $.global[self.storageKey] [idx] = newInst.m_ArrayOfObj.cloneInstance(newInst);

        $.writeln("オブジェクト登録完了。No: " + newInst.m_ArrayOfObj.ArrayIndex);
        return newInst.m_ArrayOfObj.ArrayIndex;
    } else {
        alert("Undefine Dialog")
    }

    return -1;
}


/**
 * $.global[self.storageKey] への文字列を返します
 * @returns {文字列} - $.global[self.storageKey] への文字列
 */
CGlobalArray.prototype.GetGlobalClass = function() {
    var self = this;
    var name = "$.global['" + self.storageKey + "'][" + self.ArrayIndex + "]";
    return name;
}


/**
 * $.global[self.storageKey] へのオブジェクトを返します
 * @returns {オブジェクト} - $.global[self.storageKey] へのオブジェクト
 */
CGlobalArray.prototype.GetGlobalStorageKey = function() {
    var self = this;
    return $.global[self.storageKey];
}


/**
 * $.global[self.storageKey][elf.OsbjectNo] へのオブジェクトを返します
 * @returns {オブジェクト} - $.global[self.storageKey][elf.OsbjectNo] へのオブジェクト
 */
CGlobalArray.prototype.GetGlobalObject = function() {
    var self = this;
    return self.GetGlobalStorageKey()[self.ArrayIndex];
}


/**
 * 全てのインスタンスを一括で閉じるような操作も可能になります
 */
CGlobalArray.prototype.CloseAllInstances = function() {
    var self = this;

    if ( $.global[self.storageKey].length > 0 ) {
        var instances = $.global[self.storageKey] ;
        for (var i = 0; i < instances.length; i++) {
            if (instances[i].m_Dialog) {
                instances[i].m_Dialog.close();
            }
        }
        $.global[self.storageKey]  = []; // 配列をリセット
    }
}


/**
 * ArrayIndexが指している配列を削除
 */
CGlobalArray.prototype.DeleteObject = function() {
    var self = this;
    var key  = self.GetGlobalStorageKey();
    var idx  = self.ArrayIndex;
    if (key[idx]) {
        var oldInst = key[idx];
                
        // オブジェクトの全プロパティを削除して参照を切る
        for (var prop in oldInst) {
            if (oldInst.hasOwnProperty(prop)) {
                oldInst[prop] = null;
            }
        }
        key[idx] = null; // 明示的にnullを代入

        self.m_ControlIndex.DeleteIndex(idx);

        $.writeln(idx+"の配列をメモリ解放しました");

        // 配列のすべてがnullの場合は、配列そのものを解放させる
        {
            var length = key.length;
            var AllNullFlag = true;
            for(var lp=0; lp<length; lp++) {
                if ( key[lp] != null ) {
                    AllNullFlag = false;
                    break;
                }
            }

            if ( AllNullFlag ) {
                //alert("配列をすべて消す");
                // 配列自体の参照を削除
                // 単なる [] 代入より delete の方がメモリ解放が確実です
                delete key;
                self.m_ControlIndex.Init();
                
                // ガベージコレクションの強制実行
                $.gc();

                $.writeln("配列リセット");
                //alert("配列リセット");
            }
        }

    }
}


//----------------------------------------
//  ベースクラス CPaletteWindow
//----------------------------------------

 var _OriginalWindow = Window;
 // CPaletteWindowのコンストラクタをここで定義
 function CPaletteWindow( scriptName, MaxInstance, ReSizeAble ) {
    var self = this;
    self.m_Dialog = null;
    self.m_ArrayOfObj = new CGlobalArray( scriptName, MaxInstance );

    if ( self.Is_it_possible_to_register() ) {
        $.writeln( "コンストラクタ_CPaletteWindow" );
        var resizableProp = { resizeable: ReSizeAble };
        self.m_Dialog = new Window("palette", scriptName, undefined, resizableProp);
    } else {
        self.m_ArrayOfObj = null;
    }

    // インスタンスのコンストラクタ（子クラス自身）の静的プロパティに保存することで、動的に静的プロパティを定義
    self.constructor.self = self;
}

// CPaletteWindowのメソッドをここで定義
//  ・ベースとしたいクラスに限り、下記のようにまとめてメソッドを記述しても良い。
//  ・サブクラスでは、個別にメソッドを記述すること。下記のようにまとめて記述してはいけない。
CPaletteWindow.prototype = {

    SetDialogTitle: function(title) {
        var self = this;
        if ( self.m_Dialog ) {
            self.m_Dialog.text = title;
        }
    },

    GetDialogTitle: function() {
        var self = this;
        if ( self.m_Dialog ) {
            return self.m_Dialog.text;
        }
        return "";
    },

    GetGlobalIndex: function() {
        var self = this;
        if ( self.m_ArrayOfObj ) {
            return  self.m_ArrayOfObj.ArrayIndex;
        } else {
            return -1;
        }
    },

    GetGlobalDialog: function() {
        var self = this;
        if ( self.m_ArrayOfObj ) {
            return self.m_ArrayOfObj.GetGlobalObject();
        }
        return null;
    },

    GetDialogObject: function() {
        var self = this;
        if ( self.m_ArrayOfObj ) {
            return self.m_ArrayOfObj.GetGlobalObject();
        }
        return null;
    },

    IsDialg: function() {
        var self = this;
        if (self.m_Dialog!= null) {
            return true;
        }
        return false;
    },

    DirectCallFunc: function( FuncName ) {
        var self = this;
        if ( self.m_ArrayOfObj ) {
            eval( self.m_ArrayOfObj.GetGlobalClass() + FuncName ); 
        } 
    },

    Is_it_possible_to_register: function() {
        var self = this;
        return self.m_ArrayOfObj.Is_it_possible_to_register();
    },

    CallFunc: function( FuncName ) {
            var self = this;
        if ( self.m_ArrayOfObj && self.m_ArrayOfObj.ArrayIndex >= 0 ) {
            var bt = new BridgeTalk;
            bt.target = BridgeTalk.appSpecifier;
            bt.body   = self.m_ArrayOfObj.GetGlobalClass() + FuncName;
            bt.send();
        } else {
            alert("Undefine ArrayIndex in CallFuncWithGlobalArray.");
        }
    },

    RegisterInstance: function() {
        var self = this;
        if ( self.m_ArrayOfObj ) {
            return self.m_ArrayOfObj.RegisterInstance( self );
        }
    },

    GetDlg: function() {
        var self = this;
        if (self.m_Dialog) {
            return ( self.m_Dialog );
        }
        return null;
    },

    show: function() {
        var self = this;
        var GlobalDlg = self.GetGlobalDialog();
        if (GlobalDlg && GlobalDlg.m_Dialog) {
            GlobalDlg.m_Dialog.center(); // 中央に表示
            GlobalDlg.m_Dialog.show();
            $.writeln("show()");
        } else {
            $.writeln("Error: Global instance not found for show().");
        }
    },

    close: function() {
        var self = this;
        if ( self.m_ArrayOfObj && self.m_Dialog) {
            var GlobalDlg = self.GetGlobalDialog();
            GlobalDlg.m_Dialog.close();

            //--- close後のメモリ解放 ---
            self.m_ArrayOfObj.DeleteObject();
        }
    },

    addEventListener: function( p1, p2 ) {
        var self = this;
        var Dlg = self.GetDlg();
        return Dlg.addEventListener( p1, p2 );
    },

    AddPanel: function(Text) {
        var self = this;
        var Dlg = self.GetDlg();
        var PanelText = Dlg.add( "panel") ;
        return PanelText;
    },

    AddRadioButton: function(Text) {
        var self = this;
        var Dlg = self.GetDlg();
        var RadioButtonText = Dlg.add( "radiobutton") ;
        RadioButtonText.text = Text;
        return RadioButtonText;
    },

    AddEditText: function(Text) {
        var self = this;
        var Dlg = self.GetDlg();
        var EdText = Dlg.add( "edittext") ;
        EdText.text = Text;
        return EdText;
    },

    AddStaticText: function(Text) {
        var self = this;
        var Dlg = self.GetDlg();
        var StText = Dlg.add( "statictext") ;
        StText.text = Text;
        return StText;
    },

    AddButton: function(Text) {
        var self = this;
        var Dlg = self.GetDlg();
        var Btn = Dlg.add( "button") ;
        Btn.text = Text;
        return Btn;
    },

    AddChkBox: function(Text, Value) {
        var self = this;
        var Dlg = self.GetDlg();
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

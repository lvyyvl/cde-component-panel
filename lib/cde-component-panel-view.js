/** @babel */
/** @jsx etch.dom */
'use babel';
import etch from 'etch'
import path from 'path'
import MyBufferedProcess from './MyBufferedProcess'
import fs from 'fs-extra'
import fsplus from 'fs-plus'
import fsnode from 'fs'
import SyncComponent from './SyncComponent'
import messageModule from 'atom-message-panel'

const COMPONENT_URI = 'atom://cde-component-panel'

export default class CdeComponentPanelView{
  constructor(props) {
    this.props = props
    etch.initialize(this)
    this.didClickRefreshButton = this.didClickRefreshButton.bind(this)
    this.didClickSyncButton = this.didClickSyncButton.bind(this)
  }

  didClickSyncButton(){
    // async download component json files and pictures
    new SyncComponent();
  }

  didClickRefreshButton(){
    // refresh package
    atom.workspace.getPaneItems().forEach(item => {
      if (item instanceof CdeComponentPanelView) {
          atom.workspace.getActivePane().destroyItem(item);
      }
    });
    atom.commands.dispatch(atom.views.getView(atom.workspace), 'CDE Component Library:Open')

    atom.notifications.addSuccess('Refresh complete. (刷新完成。)');
  }

  didClickDetailButton(filePath){
    atom.workspace.open(filePath);
  }

  update(){
  }

  render () {
    let body = this.readAllFileNames();

    const element = (
      <div className='cde-component-panel'>
        <div>
          <div>
            <font><b>Usage: </b>Move the cursor to the position for the component code in your file, and then drag the icon. (用法：将光标放置在您的文件中需要插入组件代码的位置，然后拖拽组件图标即可。)</font>
          </div>
          <br/>
          <div class='btn-toolbar'>
            <div class='btn-group btn-group-sm'>
              <button ref='projectButton' onclick={this.didClickSyncButton} className='btn icon icon-move-down'>
                Manual Sync (手动同步)
              </button>
              <button ref='projectButton' onclick={this.didClickRefreshButton} className='btn icon icon-repo-sync'>
                Refresh List (刷新列表)
              </button>
            </div>
          </div>
        </div>
        <div>
          <table>
            {body}
          </table>
        </div>
      </div>
    );

    return (
      element
    )
  }

  readAllFileNames(){
    componentRootPath = path.join(__dirname, '../component/')
    pngRootPath = path.join(__dirname, '../image/')
    componentPaths = fsplus.listSync(componentRootPath)
    pngPaths = fsplus.listSync(pngRootPath)
    let tempobj = []
    for(let i=0; i<componentPaths.length; i++){
      let componentPath = componentPaths[i];
      let pngPath = pngPaths[i];
      tempobj[i] = this.getPluginComponent(componentPath, pngPath)
    }
    let body = (
      tempobj
    );
    return body
  }

  getPluginComponent(componentPath, pngPath){
    let packageObj = this.getFileInfo(componentPath);
    let titleValue = packageObj.title==undefined?'':packageObj.title;
    let desValue = packageObj.des==undefined?'':packageObj.des;

    let mdFile = 'README-' + packageObj.name + '.md';
    let mdFilePath = path.join(__dirname, '../readme/', mdFile);

    return (
      <tr>
        <td className='image-td-style'>
          <a>
            <img width="60" height="60" src={pngPath} ondragend={() => this.addContentToEditor(componentPath)} />
          </a>
        </td>
        <td>
          <atom-panel class='padded'>
              <div class="inset-panel">
                  <div class="panel-heading">
                    <font className='titleFont'>{titleValue}</font>
                  </div>
                  <div class="panel-body padded">
                    <div>
                      <font className='desFont'>{desValue} </font>
                      <div class='btn-group btn-group-xs'>
                          <button onclick={() => this.didClickDetailButton(mdFilePath)} class='btn'>More Info</button>
                      </div>
                    </div>
                  </div>
              </div>
          </atom-panel>
        </td>
      </tr>
    )
  }

  getFileInfo(componentPath){
    const packageObj = fs.readJsonSync(componentPath)
    return packageObj
  }

  addContentToEditor(componentPath){
    let editor = atom.workspace.getActiveTextEditor()
    let cursor = editor.getCursorBufferPosition()
    let pos = { //save the current position of the cursor
      row: cursor.row,
      col: cursor.column
    }

    if(editor != undefined){
      fs.readJson(componentPath, (err, packageObj) => {
        if(err){
          throw err;
          console.log(err)
        } else {
          let openPath = this.getActiveEditorProjectPath(editor);
          if(openPath === null || openPath === ''){
            throw 'This open file belongs no RN project, pls save it first. (当前文件不属于任何RN项目，请先将文件保存到项目目录中。)';
            console.log('This open file belongs no project, pls save it first')
          } else {
            let addImportValue = packageObj.importStr;
            let wholeText = editor.getText();
            let newlines = 0;

            if(wholeText.indexOf(addImportValue) == -1){
              let writeImport = addImportValue + '\n' + wholeText;
              newlines++;
              let newlineString = addImportValue.match(/\n/g) //count the newlines added by the imported string
              if(newlineString != null) {
                newlines += newlineString.length
              }
              editor.setText(writeImport);
            }
            editor.setCursorBufferPosition([pos.row + newlines,pos.col]); //restore to the saved cursor position

            let codesnippet = packageObj.content.split("$$$$$$$$")[1]==undefined?'':packageObj.content.split("$$$$$$$$")[1];
            editor.insertText(codesnippet.replace(/@@/g, '\n'), {
              select: true,
              autoIndent: true,
              autoIndentNewline: true,
              autoDecreaseIndent: true
            });
            this.addNpmtoPackagejson(packageObj.command, openPath)
          }
        }
      })
    }
  }

  addNpmtoPackagejson(command, openPath){
    let errMessage = '';
    this.showStateMessage();
    // run command download npm
    stdout = (output) => {
      console.log(output)
      if(output.indexOf('ERR!') !== -1){
        errMessage = 'error';
        this.messages.add(new PlainMessageView({
          message: output,
          className: 'text-success'
        }));
      }
    }
    stderr = (output) => {
      console.log(output)
      if(output.indexOf('ERR!') !== -1){
        errMessage = 'error';
        this.messages.add(new PlainMessageView({
          message: output,
          className: 'text-success'
        }));
      }
    }
    stdExit = () => {
      if(errMessage !== ''){
        this.messages.attach();
        throw 'Package installing happened error.';
      } else {
        atom.notifications.addSuccess('Component installed successfully. (组件包安装完成。)');
      }
    }
    this.runComplexCommand("cd /d " + openPath + " & " + command, stdout, stderr, stdExit)
  }

  showStateMessage(){
    MessagePanelView = messageModule.MessagePanelView,
    PlainMessageView = messageModule.PlainMessageView;

    this.messages = new MessagePanelView({
      title: 'Component Library Message (组件库消息)',
      maxHeight:'200px',
      recentMessagesAtTop:false
    });
  }

  getActiveEditorProjectPath(editor){
    let allOpenProjectPaths = atom.project.getPaths(); // get all added project paths
    let currentFilePath = path.dirname(editor.getPath());
    let projectPath = '';
    for (i = 0, len = allOpenProjectPaths.length; i < len; i++) {
      directory = allOpenProjectPaths[i];
      if (currentFilePath.indexOf(directory) > -1) {
        projectPath = directory;
      }
    }
    return projectPath;
  }

  runComplexCommand(command, stdout, stderr, exit){
    new MyBufferedProcess({command, stdout, stderr, exit})
  }

  // Optional: Destroy the component. Async/await syntax is pretty but optional.
  // async destroy () {
  //   // call etch.destroy to remove the element and destroy child components
  //   await etch.destroy(this)
  //   // then perform custom teardown logic here...
  // }

  getElement() {
    return this.element;
  }

  getTitle() {
    // Used by Atom for tab text
    return 'Component Lib';
  }

  getIconName() {
    return 'code';
  }

  getDefaultLocation() {
    return 'right';
  }

  getPreferredWidth() {
    return 300;
  }

  getURI() {
    // Used by Atom to identify the view when toggling.
    return this.props.uri
  }

  isEqual (other) {
    other instanceof CdeComponentPanelView
  }

  // serialize() {
  //   return {
  //     // This is used to look up the deserializer function. It can be any string, but it needs to be
  //     // unique across all packages!
  //     deserializer: 'cde-component-panel/CdeComponentPanelView',
  //     uri: this.props.uri
  //   }
  // }
}

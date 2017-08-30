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
  }

  // Required: Update the component with new properties and children.
  // update (newprops) {
  //   if (this.props.state !== newprops.state) {
  //     this.props.state = newprops.state
  //     return etch.update(this)
  //   } else {
  //     return Promise.resolve()
  //   }
  // }
  //
  // updateSync(newprops){
  //   if (this.props.state !== newprops.state) {
  //     this.props.state = newprops.state
  //     return etch.updateSync(this)
  //   } else {
  //     return Promise.resolve()
  //   }
  // }

  update(){

  }

  render () {
    let body = this.readAllFileNames();

    const element = (
      <div className='cde-component-panel'>
        <div className='div-margin-bottom'>
          <button ref='projectButton' onclick={this.didClickSyncButton} className='btn btn-primary inline-block-tight icon icon-arrow-down'>
            Sync
          </button>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <button ref='projectButton' onclick={this.didClickRefreshButton} className='btn btn-primary inline-block-tight icon icon-repo-sync'>
            Refresh
          </button>
        </div>
        <div className='div-margin-bottom'>
            <font>Tip: Drag and drop the component into the cursor position of your code.</font>
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
    let desValue = packageObj.des==undefined?'':packageObj.des;
    let titleValue = packageObj.title==undefined?'':packageObj.title;

    return (
      <tr>
        <td className='image-td-style'><a><img width="60" height="60" src={pngPath} ondragend={() => this.addContentToEditor(componentPath)} /></a></td>
        <td><div><font className='titleFont'>{titleValue}</font></div><div className='div-margin-top'><font className='desFont'>{desValue}</font></div></td>
      </tr>
    )
  }

  getFileInfo(componentPath){
    const packageObj = fs.readJsonSync(componentPath)
    return packageObj
  }

  addContentToEditor(componentPath){
    let editor = atom.workspace.getActiveTextEditor()
    if(editor != undefined){
      fs.readJson(componentPath, (err, packageObj) => {
        if(err){
          throw err;
          console.log(err)
        } else {
          let openPath = this.getActiveEditorProjectPath(editor);
          if(openPath === null || openPath === ''){
            throw 'this open file belongs no project, pls save it first';
            console.log('this open file belongs no project, pls save it first')
          } else {
            let addImportValue = packageObj.importStr;
            let wholeText = editor.getText();
            if(wholeText.indexOf(addImportValue) == -1){
              let writeImport = addImportValue + '\n' + wholeText;
              editor.setText(writeImport);
            }
            editor.insertText(packageObj.content.replace(/@@/g,'\n'))
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
        atom.notifications.addSuccess('Component installed successfully.');
      }
    }
    this.runComplexCommand("cd /d " + openPath + " & " + command, stdout, stderr, stdExit)
  }

  showStateMessage(){
    MessagePanelView = messageModule.MessagePanelView,
    PlainMessageView = messageModule.PlainMessageView;

    this.messages = new MessagePanelView({
      title: 'Component Library Info',
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
    return 'Component Library';
  }

  getURI() {
    // Used by Atom to identify the view when toggling.
    return this.props.uri
  }

  isEqual (other) {
    other instanceof CdeComponentPanelView
  }

  serialize() {
    return {
      // This is used to look up the deserializer function. It can be any string, but it needs to be
      // unique across all packages!
      deserializer: 'cde-component-panel/CdeComponentPanelView',
      uri: this.props.uri
    }
  }
}

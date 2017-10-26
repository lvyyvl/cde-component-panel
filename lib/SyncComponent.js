/** @babel */
/** @jsx etch.dom */

import http from 'http'
import url from 'url'
import $ from 'jquery'
import fs from 'fs-extra'
import fsplus from 'fs-plus'
import fsnode from 'fs'
import path from 'path'

const hostIp = 'speed.lenovo.com';
const clientNum = 8080;
const requestJsonUrl = 'http://' + hostIp + ':' + clientNum + '/cdecomponent/cdecpon/getAllComponentsJson.do'
const requestImagePath = '/cdecomponent/images/';

export default class SyncComponent {
    constructor(props) {
      this.props = props

      function isDir(path) {
        try {
          return fs.statSync(path).isDirectory();
        } catch (e) {
          if (e.code === 'ENOENT') {
            return false;
          } else {
            throw e;
          }
        }
      }

      $.ajax({
        url:requestJsonUrl,
        type:'get',
        error: function(err){
          console.log(err);
        },
        success: function(obj){
          if(obj !== null && obj !== '' && obj !== '[]'){
            let json = JSON.parse(obj);  // 字符串转JSON数组
            let componentRootPath = path.join(__dirname, '../component/');
            let pngRootPath = path.join(__dirname, '../image/');
            let mdRootPath = path.join(__dirname, '../readme/');
            let remoteNames = [];
            let localnames = [];

            // read all local component files into an object array
            let mapLocalCpn = {};
            let componentPaths = fsplus.listSync(componentRootPath);
            for(let i=0; i<componentPaths.length; i++){
              const packageObj = fs.readJsonSync(componentPaths[i]);
              mapLocalCpn[packageObj.name] = packageObj;
              localnames.push(packageObj.name);
            }

            // update or download new component to local
            for(let i=0; i<json.length; i++){
                let obj = json[i];
                // console.log(index + '    ' + obj.name + '     ' + obj.des+ '     ' + obj.time);
                remoteNames.push(obj.name);

                // init data
                let filepath = componentRootPath + obj.name +'.json';
                let pngNamePath = pngRootPath + obj.name + '.png';
                let mdFilePath = mdRootPath + 'README-' +obj.name +'.md';
                let content = JSON.stringify(obj);

                let readme = obj.content.split("$$$$$$$$")[0]==undefined?'':obj.content.split("$$$$$$$$")[0];
                let insertReadme = readme.replace(/@@/g, '\n');

                if($.inArray(obj.name,localnames) === -1){ // -1 means not found
                  // generate the new file
                  fsplus.writeFile(filepath, content, (error) => {});

                  // download new picture
                  let file = fsnode.createWriteStream(pngRootPath + obj.name + '.png');
                  http.get({
                     hostname: hostIp,
                     port: clientNum,
                     path: requestImagePath + obj.name + '.png',
                     agent: false  // 创建一个新的代理，只用于本次请求
                  }, (res) => {
                     // 对响应进行处理
                     res.on('data',function(data) {
                       file.write(data);
                     }).on('end',function() {
                       file.end();
                     });
                  });

                  // generate the new description file
                  if(!isDir(mdRootPath)) {
                    fs.mkdir(mdRootPath);
                  }

                  fsplus.writeFile(mdFilePath, insertReadme, (error) => {});
                } else {
                  let localObj = mapLocalCpn[obj.name];
                  let remoteTime = new Date(obj.time.replace("-", "/").replace("-", "/"));
                  let localTime = new Date(localObj.time.replace("-", "/").replace("-", "/"));
                  if(remoteTime > localTime){
                    // update the mapping file new content
                    fsplus.writeFile(filepath, content, (error) => {});

                    // update the new picture
                    fsplus.removeSync(pngNamePath);
                    let file = fsnode.createWriteStream(pngRootPath + obj.name + '.png');
                    http.get({
                       hostname: hostIp,
                       port: clientNum,
                       path: requestImagePath + obj.name + '.png',
                       agent: false  // 创建一个新的代理，只用于本次请求
                    }, (res) => {
                       // 对响应进行处理
                       res.on('data',function(data) {
                         file.write(data);
                       }).on('end',function() {
                         file.end();
                       });
                    });

                    // update the description file
                    if(!isDir(mdRootPath)) {
                      fs.mkdir(mdRootPath);
                    }
                    fsplus.writeFile(mdFilePath, insertReadme, (error) => {});
                  }
                }
            }

            // delete local component which remote does't have
            for(let i=0; i<localnames.length; i++){
              let obj = localnames[i];
              if($.inArray(obj, remoteNames) === -1){ // -1 means not found
                let filepath = componentRootPath + obj +'.json';
                let mdFilePath = mdRootPath + 'README-' +obj.name +'.md';
                let pngpath = pngRootPath + obj +'.png';
                // fsplus.removeSync(filepath);
                // fsplus.removeSync(pngpath);
                fsnode.unlinkSync(filepath);
                fsnode.unlinkSync(pngpath);
                fsnode.unlinkSync(mdFilePath);
              }
            }
          } else {
            // remote has nothing component, delete all local component
            let filePaths = fsplus.listSync(componentRootPath)
            for(let i=0; i<componentPaths.length; i++){
              let filePath = componentPaths[i];
              fsplus.removeSync(filePath);
            }

            let pngPaths = fsplus.listSync(pngRootPath)
            for(let i=0; i<pngPaths.length; i++){
              let pngPath = pngPaths[i];
              fsplus.removeSync(pngPath);
            }

            let desPaths = fsplus.listSync(mdRootPath)
            for(let i=0; i<mdRootPath.length; i++){
              let desPath = desPaths[i];
              fsplus.removeSync(desPath);
            }
          }
          atom.notifications.addSuccess('Auto Sync complete, click Refresh List button to display the new list. (组件库自动同步完成，点击‘刷新列表’按钮显示最新列表。)');
        }
      })
  }
}

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
    $.ajax({
      // async: this.props.async,//使用同步的方式,true为异步方式
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
              let content = JSON.stringify(obj);

              if($.inArray(obj.name,localnames) === -1){ // -1 means not found
                // generate the new file
                fsplus.writeFile(filepath, content);
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
              } else {
                let localObj = mapLocalCpn[obj.name];
                let remoteTime = new Date(obj.time.replace("-", "/").replace("-", "/"));
                let localTime = new Date(localObj.time.replace("-", "/").replace("-", "/"));
                if(remoteTime > localTime){
                  // update the mapping file new content
                  fsplus.writeFile(filepath, content);
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
                }
              }
          }

          // delete local component which remote does't have
          for(let i=0; i<localnames.length; i++){
            let obj = localnames[i];
            if($.inArray(obj, remoteNames) === -1){ // -1 means not found
              let filepath = componentRootPath + obj +'.json';
              let pngpath = pngRootPath + obj +'.png';
              // fsplus.removeSync(filepath);
              // fsplus.removeSync(pngpath);
              fsnode.unlinkSync(filepath);
              fsnode.unlinkSync(pngpath);
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
        }
        atom.notifications.addSuccess('Auto Sync complete, click Refresh button to display the new list. (组件库自动同步完成，点击‘刷新’按钮显示最新列表。)');
      }
    })
  }
}

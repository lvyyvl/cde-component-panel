'use babel';

import CdeComponentPanelView from './cde-component-panel-view';
import SyncComponent from './SyncComponent';
import { CompositeDisposable, Disposable } from 'atom';

let ComponentView
const COMPONENT_URI = 'atom://cde-component-panel'

export default {

  async activate(state) {
    this.cdeComponentPanelView = new CdeComponentPanelView(state.cdeComponentPanelViewState);

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.workspace.addOpener(uri => {
        if (uri === COMPONENT_URI) {
          return this.createCdeComponentPanelView({uri: COMPONENT_URI});
        }
      })
    );

    // Destroy any CdeComponentPanelView when the package is deactivated.
    this.subscriptions.add(
      new Disposable(() => {
        atom.workspace.getPaneItems().forEach(item => {
          if (item instanceof CdeComponentPanelView) {
            item.destroy();
          }
        });
      })
    );

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'CDE Component Library:Open': () => this.show()
    }));

    // async download component json files and pictures
    new SyncComponent();
  },

  show() {
    return Promise.all([
      atom.workspace.toggle(COMPONENT_URI, {location: 'right', split: 'up'}),
    ])
  },

  deactivate() {
    this.subscriptions.dispose();
    this.element.remove();
  },

  createCdeComponentPanelView(state) {
    if (ComponentView == null) ComponentView = require('./cde-component-panel-view')
    return new CdeComponentPanelView({...state})
  }

};


import {
  CHANGES_CREATE_REQUEST,
  CHANGES_READ_REQUEST,
  CHANGES_UPDATE_REQUEST,
  CHANGES_DELETE_REQUEST,
  CHANGE_EVENT
} from '../constants';

import dispatcher from '../dispatcher/AppDispatcher';
import storage from '../storage';
import AccountStore from '../stores/AccountStore';
import { EventEmitter } from 'events';
import axios from 'axios';

import Worker from '../workers/Changes.worker';

let firstRating = new Map();
let chainAccountId = null;
let chain = [];

class ChangeStore extends EventEmitter {

  constructor() {
    super();
    // Initialize worker
    this.worker = new Worker();
    this.worker.onmessage = function(event) {
      // Receive message { type: ..., changes: ... }
      switch(event.data.type){
        case CHANGES_CREATE_REQUEST:
          break;
        case CHANGES_READ_REQUEST:
          if (event.data.changes) {
            ChangeStoreInstance.emitChange(event.data.changes);
          }
          break;
          break;
        case CHANGES_UPDATE_REQUEST:
          break;
        case CHANGES_DELETE_REQUEST:
          break;
        default:
          return;
      };
    }
  }

  emitChange(...args) {
    this.emit(CHANGE_EVENT, ...args);
  }

  addChangeListener(callback) {
    this.on(CHANGE_EVENT, callback);
  }

  removeChangeListener(callback) {
    this.removeListener(CHANGE_EVENT, callback);
  }

  onceChangeListener(callback) {
    this.once(CHANGE_EVENT, callback);
  }

  /**
   * firstRating contain the first exchange rate of every currency ever met
   * It is used to estimate calculation for transactions BEFORE change object is recoreded
   * @return {Map}
   */
  get firstRating() {
    return firstRating;
  }

  getChangeChain() {
    // Caching to not regenerate the chain on every request
    if (AccountStore.selectedAccount().id === chainAccountId) {
      return Promise.resolve(chain);
    } else {
      return ChangeStoreInstance.buildChangeChain();
    }
  }

  /**
   * This function create a chain of change event.
   * It is represented as a timeline, to get the exchange rate of a transaction
   * you get the first item from the change before that date, and access all exchange ratio available.
   * @return {Promise}
   */
  buildChangeChain() {

    // OLD CHAIN PATTERN TO REPLICATE
    return new Promise((resolve, reject) => {
      chain = [];
      var counter = 0;
      var lastItem = {};
      var changes = [];

      var index = storage
                .db
                .transaction('changes')
                .objectStore('changes')
                .index('account');
      var keyRange = IDBKeyRange.only(AccountStore.selectedAccount().id);
      let cursor = index.openCursor(keyRange);

      cursor.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
          changes.push(event.target.result.value);
          cursor.continue();
        } else {

          changes = changes.sort((a, b) => {
            return a.date > b.date ? 1 : -1;
          });

          for (var i in changes) {
            var item = {
              id: changes[i].id,
              account: changes[i].account,
              date: changes[i].date,
              rates: new Map(lastItem.rates),
              secondDegree: new Map(lastItem.secondDegree),
            };

            // GENERATE FIRST RATING
            // If first time using this localCurrency
            if (item.rates.get(changes[i]['local_currency']) === undefined) {
              firstRating.set(changes[i]['local_currency'], new Map());
            }
            if (firstRating.get(changes[i]['local_currency']).get(changes[i]['new_currency']) === undefined) {
              firstRating.get(changes[i]['local_currency']).set(changes[i]['new_currency'], changes[i]['exchange_rate']);
            }

            // If first time using this new Currency
            if (item.rates.get(changes[i]['new_currency']) === undefined) {
              firstRating.set(changes[i]['new_currency'], new Map());
            }
            if (firstRating.get(changes[i]['new_currency']).get(changes[i]['local_currency']) === undefined) {
              firstRating.get(changes[i]['new_currency']).set(changes[i]['local_currency'], 1/changes[i]['exchange_rate']);
            }

            // GENERERATE CHAIN ITEM
            item.rates.set(changes[i]['local_currency'], new Map(item.rates.get(changes[i]['local_currency'])));
            item.rates.get(changes[i]['local_currency']).set(changes[i]['new_currency'], changes[i]['exchange_rate']);

            item.rates.set(changes[i]['new_currency'], new Map(item.rates.get(changes[i]['new_currency'])));
            item.rates.get(changes[i]['new_currency']).set(changes[i]['local_currency'], 1/changes[i]['exchange_rate']);

            // CALCULATE CROSS REFERENCE RATE WITH MULTI CURRENCY VALUES
            //
            // console.log('rates');
            // console.log(JSON.stringify(item.rates));
            // We take
            //
            // Algo:
            //  1 -> 2 -> 3
            //    x    y
            //  1 is changes[i]['local_currency']
            //  2 is changes[i]['new_currency']
            //  x is exchange rate between 1 and 2
            //  we need to calculate y and save it as 1 -> 3
            item.rates.get(changes[i]['local_currency']).forEach((value, key) => {
              if (key !== changes[i]['new_currency']) {
                item.rates.get(key);
                // console.log('local to key');
                // console.log(changes[i]['local_currency'] + ' > ' + key + ' > ' + changes[i]['new_currency'] );
                // console.log(changes[i]['local_currency'] + ' > ' + changes[i]['new_currency'] + ' : ' + changes[i]['exchange_rate'] );
                // console.log(changes[i]['local_currency'] + ' > ' + key + ' : ' + item.rates.get(changes[i]['local_currency']).get(key) );
                // console.log(key + ' > ' + changes[i]['new_currency'] + ' : ' + changes[i]['exchange_rate'] / value );
                // console.log(changes[i]['new_currency'] + ' > ' + key + ' : ' + 1/(changes[i]['exchange_rate'] / value));

                if (item.secondDegree.get(key) === undefined) {
                  item.secondDegree.set(key, new Map());
                }
                item.secondDegree.get(key).set(changes[i]['new_currency'], changes[i]['exchange_rate'] / value);

                if (item.secondDegree.get(changes[i]['new_currency']) === undefined) {
                  item.secondDegree.set(changes[i]['new_currency'], new Map());
                }
                item.secondDegree.get(changes[i]['new_currency']).set(key, 1/(changes[i]['exchange_rate'] / value));

                // We also need to update firstRate with this new value ... sad :(
                if (firstRating.get(key) === undefined) {
                  firstRating.set(key, new Map());
                }
                if (firstRating.get(key).get(changes[i]['new_currency']) === undefined) {
                  firstRating.get(key).set(changes[i]['new_currency'], changes[i]['exchange_rate'] / value);
                }

                if (firstRating.get(changes[i]['new_currency']) === undefined) {
                  firstRating.set(changes[i]['new_currency'], new Map());
                }
                if (firstRating.get(changes[i]['new_currency']).get(key) === undefined) {
                  firstRating.get(changes[i]['new_currency']).set(key, 1/(changes[i]['exchange_rate'] / value));
                }

                // console.log('secondDegree');
                // console.log(JSON.stringify(item.secondDegree));
              }
              // item.secondDegree = item.secondDegree;
            });

            chain.push(item);
            lastItem = item;
          }

          chain = chain.sort((a, b) => {
            return a.date < b.date ? 1 : -1;
          });


          chainAccountId = AccountStore.selectedAccount().id;
          resolve(chain);
        }
      }
    });
  }

  initialize() {
    var that = this;
    return axios({
      url: '/api/v1/changes',
      method: 'get',
      headers: {
        'Authorization': 'Token '+ localStorage.getItem('token'),
      },
    })
    .then(function(response) {
      // changes = response.data;

      // var customerObjectStore  = storage.db.transaction('changechain', 'readwrite').objectStore('changechain');

      // that.buildChangeChain().then(() => {
      //   ChangeStoreInstance.emitChange();
      // });

      // Load transactions store
      var customerObjectStore  = storage.db.transaction('changes', 'readwrite').objectStore('changes');
      // Delete all previous objects
      customerObjectStore.clear();
      var counter = 0;
      // For each object retrieved by our request.
      for (var i in response.data) {
        // Save in storage.
        var request = customerObjectStore.add(response.data[i]);
        request.onsuccess = function(event) {
          counter++;
          // On last success, we trigger an event.
          if (counter === response.data.length) {
            ChangeStoreInstance.emitChange();
          }
        };
        request.onerror = function(event) {
          console.error(event);
        };
      }

    }).catch(function(ex) {
      console.error(ex);
    });
  }

  reset() {
    return new Promise((resolve) => {
      firstRating = new Map();
      chainAccountId = null;
      chain = [];
      storage.db.transaction('changes', 'readwrite').objectStore('changes').clear();
      resolve();
    });
  }
}

let ChangeStoreInstance = new ChangeStore();

ChangeStoreInstance.dispatchToken = dispatcher.register(action => {

  if ([CHANGES_READ_REQUEST].indexOf(action.type) !== -1) {

    ChangeStoreInstance.worker.postMessage(action);

  }

  switch(action.type) {
  case CHANGES_CREATE_REQUEST:
      // Create categories
    axios({
      url: '/api/v1/changes',
      method: 'POST',
      headers: {
        'Authorization': 'Token '+ localStorage.getItem('token'),
      },
      data: action.change
    })
      .then((response) => {
        if (response.data) {
          storage
              .db
              .transaction('changes', 'readwrite')
              .objectStore('changes')
              .put(response.data);
          ChangeStoreInstance.emitChange();
        } else {
          return Promise.reject();
        }
      })
      .catch((exception) => {
        ChangeStoreInstance.emitChange(exception.response ? exception.response.data : null);
      });
    break;
  case CHANGES_UPDATE_REQUEST:
      // Create categories
    axios({
      url: '/api/v1/changes/' + action.change.id,
      method: 'PUT',
      headers: {
        'Authorization': 'Token '+ localStorage.getItem('token'),
      },
      data: action.change
    })
      .then((response) => {
        if (response.data) {
          storage
              .db
              .transaction('changes', 'readwrite')
              .objectStore('changes')
              .put(response.data);
          ChangeStoreInstance.emitChange();
        } else {
          return Promise.reject();
        }
      })
      .catch((exception) => {
        ChangeStoreInstance.emitChange(exception.response ? exception.response.data : null);
      });
    break;
  case CHANGES_DELETE_REQUEST:
    axios({
      url: '/api/v1/changes/' + action.change.id,
      method: 'DELETE',
      headers: {
        'Authorization': 'Token '+ localStorage.getItem('token'),
      }
    })
      .then((response) => {
        storage
              .db
              .transaction('changes', 'readwrite')
              .objectStore('changes')
              .delete(action.change.id);
        ChangeStoreInstance.emitChange();
      })
      .catch((exception) => {
        console.error(exception);
      });
    break;
  default:
    return;
  }

});

export default ChangeStoreInstance;

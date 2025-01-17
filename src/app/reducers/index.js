import { combineReducers } from 'redux'
import { reducer as formReducer } from 'redux-form'
import { reducer as toastrReducer } from 'react-redux-toastr'
import { routerReducer } from 'react-router-redux'
import asset from './asset'
import affiliate from './affiliate'
import priceChart from './priceChart'
import swap from './swap'
import swundle from './swundle'
import orderModal from './orderModal'
import settings from './settings'
import portfolio from './portfolio'
import wallet from './wallet'
import app from './app'
import accountSearch from './accountSearch'
import walletPasswordPrompt from './walletPasswordPrompt'
import connectHardwareWallet from './connectHardwareWallet'
import tx from './tx'
import rate from './rate'
import i18n from './i18n'

export default combineReducers({
  app,
  i18n,
  accountSearch,
  portfolio,
  wallet,
  asset,
  affiliate,
  rate,
  tx,
  swap,
  swundle,
  orderModal,
  settings,
  priceChart,
  walletPasswordPrompt,
  connectHardwareWallet,
  form: formReducer,
  toastr: toastrReducer,
  router: routerReducer,
})

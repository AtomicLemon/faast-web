import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { push } from 'react-router-redux'

import config from 'Config'
import toastr from 'Utilities/toastrWrapper'
import { timer } from 'Utilities/helpers'
import { setStatePromise } from 'Utilities/reactFuncs'
import { toMainDenomination } from 'Utilities/convert'
import log from 'Utilities/log'
import { closeTrezorWindow } from 'Utilities/wallet'

import { openWallet } from 'Actions/access'

import web3 from 'Services/Web3'
import { EthereumWalletLedger, EthereumWalletTrezor, BitcoinWalletTrezor } from 'Services/Wallet'
import Trezor from 'Services/Trezor'

import HardwareWalletModalView from './view'

const CONNECT_SECONDS = 6
const ADDRESS_GROUP_SIZE = 5
let hwConnectTimer
let hwConnectTimerTimeout

const initialState = {
  showAddressSelect: false,
  accounts: [],
  selectedPage: 0,
  selectedIndex: 0,
  commStatus: '',
  seconds: CONNECT_SECONDS,
  getAddress: () => Promise.resolve(),
}

class HardwareWalletModal extends Component {
  constructor (props) {
    super(props)
    this.state = Object.assign({}, initialState, {
      derivationPath: config.hdDerivationPath[props.type]
    })
    this.setStatePromise = (newState) => setStatePromise(this, newState)
    this._handleOpenModal = this._handleOpenModal.bind(this)
    this._handleToggleModal = this._handleToggleModal.bind(this)
    this._handleCloseModal = this._handleCloseModal.bind(this)
    this._handleToggleAddressSelect = this._handleToggleAddressSelect.bind(this)
    this._clearAsync = this._clearAsync.bind(this)
    this._connect = this._connect.bind(this)
    this._connectLedger = this._connectLedger.bind(this)
    this._connectTrezor = this._connectTrezor.bind(this)
    this._getAddresses = this._getAddresses.bind(this)
    this._handleChangePage = this._handleChangePage.bind(this)
    this._handleSelectIndex = this._handleSelectIndex.bind(this)
    this._handleChangeDerivationPath = this._handleChangeDerivationPath.bind(this)
    this._handleConfirmAccountSelection = this._handleConfirmAccountSelection.bind(this)
    this._mergeAccountState = this._mergeAccountState.bind(this)
  }

  componentDidUpdate (prevProps) {
    if (!prevProps.isOpen && this.props.isOpen) {
      this._connect()
    }
    if (prevProps.isOpen && !this.props.isOpen) {
      this._clearAsync()
    }
  }

  componentWillUnmount () {
    this._clearAsync()
  }

  _handleOpenModal () {
    this.props.setOpen(true)
  }

  _handleToggleModal () {
    if (this.props.isOpen) {
      this._handleCloseModal()
    } else {
      this._handleOpenModal()
    }
  }

  _handleCloseModal () {
    closeTrezorWindow()
    this.props.setOpen(false)
    this.setState({
      ...initialState,
      derivationPath: config.hdDerivationPath[this.props.type]
    })
  }

  _handleToggleAddressSelect () {
    this.setState({ showAddressSelect: !this.state.showAddressSelect })
  }

  _clearAsync () {
    window.clearInterval(hwConnectTimer)
    window.clearTimeout(hwConnectTimerTimeout)
  }

  _connect () {
    if (!window.faast || !window.faast.hw) {
      return toastr.error('Error: hardware wallet support unavailable')
    }
    const type = this.props.type
    this._clearAsync()
    this.setState({
      seconds: CONNECT_SECONDS
    })

    if (type === 'ledger') this._connectLedger()
    if (type === 'trezor') this._connectTrezor()
  }

  _connectLedger () {
    if (!window.faast.hw.ledger) {
      return toastr.error('Error: Ledger comm unavailable')
    }

    const setSeconds = (sec) => {
      this.setState({ seconds: sec })
    }

    const resetTimer = () => {
      this.setState({ commStatus: 'waiting', seconds: CONNECT_SECONDS })
      window.clearInterval(hwConnectTimer)
      hwConnectTimer = timer(CONNECT_SECONDS, setSeconds, ledgerConnect)
    }

    const ledgerError = (e) => {
      log.error(e)
      window.clearTimeout(hwConnectTimerTimeout)
      hwConnectTimerTimeout = window.setTimeout(resetTimer, 1000)
    }

    const ledgerConnect = () => {
      const { derivationPath } = this.state
      this.setState({ commStatus: 'connecting' })

      return EthereumWalletLedger.connect(derivationPath)
        .then(({ getAddress }) => {
          this.setState({ commStatus: 'connected', getAddress })
          this._getAddresses()
        })
        .catch(ledgerError)
    }
    ledgerConnect()
  }

  _connectTrezor () {
    if (!Trezor) {
      return toastr.error('Error: Trezor Connect unavailable')
    }

    const { derivationPath } = this.state
    this.setState({ commStatus: 'connecting' })

    const trezorError = (e) => {
      const message = e.message
      if (['cancelled', 'window closed'].includes(message.toLowerCase())) {
        this.setState({ commStatus: 'cancelled' })
      } else {
        log.error(e)
        toastr.error(`Error from Trezor - ${message}`)
        this.setState({ commStatus: 'error' })
      }
    }
    return EthereumWalletTrezor.connect(derivationPath)
      .then(({ getAddress }) => {
        this.setState({ commStatus: 'connected', getAddress })
        this._getAddresses()
      })
      .catch(trezorError)
  }

  _mergeAccountState (index, accountState) {
    const lastTransition = this.lastTransition || Promise.resolve()
    return lastTransition.then(() => {
      this.lastTransition = this.setStatePromise((prev) => {
        console.log('mergeAccountState', index, accountState)
        const newAccounts = [...prev.accounts]
        newAccounts[index] = { ...(newAccounts[index] || {}), ...accountState }
        return {
          ...prev,
          accounts: newAccounts
        }
      })
      return this.lastTransition
    })
  }

  _getAddresses (page = 0) {
    const { getAddress } = this.state
    const startIndex = page * ADDRESS_GROUP_SIZE
    const endIndex = startIndex + (ADDRESS_GROUP_SIZE - 1)
    for (let i = startIndex; i <= endIndex; i++) {
      getAddress(i).then((address) => Promise.all([
        this._mergeAccountState(i, { address }),
        web3.eth.getBalance(address)
          .then((balance) => this._mergeAccountState(i, {
            balance: toMainDenomination(balance, 18)
          }))
      ]))
      .catch(log.error)
    }
  }

  _handleChangePage (page) {
    if (page >= 0) {
      this.setState({ selectedPage: page })
      this._getAddresses(page)
    }
  }

  _handleSelectIndex (index) {
    this.setState({ selectedIndex: Number.parseInt(index), showAddressSelect: false })
  }

  _handleChangeDerivationPath (path) {
    if (this.state.derivationPath !== path) {
      this.setStatePromise({
        accounts: [],
        selectedPage: 0,
        selectedIndex: 0,
        derivationPath: path
      }).then(() => this._connect())
    }
  }

  _handleConfirmAccountSelection () {
    const { accounts, derivationPath, selectedIndex } = this.state
    const { address } = accounts[selectedIndex]
    const addressPath = `${derivationPath}/${selectedIndex}`
    const { type, openWallet, routerPush } = this.props
    let wallet
    if (type === 'ledger') {
      wallet = new EthereumWalletLedger(address, addressPath)
      openWallet(wallet)
        .then(() => routerPush('/balances'))
    } else if (type === 'trezor') {
      wallet = new EthereumWalletTrezor(address, addressPath)
      BitcoinWalletTrezor.fromPath()
        .then((bitcoinWallet) => openWallet(bitcoinWallet))
        .then(() => openWallet(wallet))
        .then(() => closeTrezorWindow())
        .then(() => routerPush('/balances'))
    } else {
      throw new Error(`Unknown hardware wallet type ${type}`)
    }
    log.info('Hardware wallet set')
  }

  render () {
    const {
      selectedPage, selectedIndex, accounts, commStatus, seconds, derivationPath,
      showAddressSelect
    } = this.state
    const startIndex = selectedPage * ADDRESS_GROUP_SIZE
    const endIndex = startIndex + (ADDRESS_GROUP_SIZE - 1)
    const selectedPageAccounts = accounts.slice(startIndex, endIndex + 1).map((a, i) => ({ ...a, index: startIndex + i }))
    const selectedAccount = accounts[selectedIndex] || {}
    const { address, balance } = selectedAccount
    const viewProps = {
      handleOpen: this._handleOpenModal,
      handleToggle: this._handleToggleModal,
      handleClose: this._handleCloseModal,
      confirmAccountSelection: this._handleConfirmAccountSelection,
      showAccountSelect: showAddressSelect,
      toggleAccountSelect: this._handleToggleAddressSelect,
      commStatus,
      onConfirm: this._handleConfirmAccountSelection,
      disableConfirm: typeof balance === 'undefined' || balance === null,
      commStatusProps: {
        status: commStatus,
        seconds: seconds,
        handleManualRetry: this._connect,
      },
      confirmAccountSelectionProps: {
        address,
        balance,
        index: selectedIndex,
        toggleAccountSelect: this._handleToggleAddressSelect
      },
      accountSelectProps: {
        startIndex,
        endIndex,
        page: selectedPage,
        accounts: selectedPageAccounts,
        derivationPath: derivationPath,
        selectIndex: this._handleSelectIndex,
        changePage: this._handleChangePage,
        changePath: this._handleChangeDerivationPath,
      }
    }
    return (
      <HardwareWalletModalView
        {...this.props}
        {...viewProps}
      />
    )
  }
}

const mapDispatchToProps = {
  openWallet,
  routerPush: push,
}

HardwareWalletModal.propTypes = {
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  instructions: PropTypes.arrayOf(PropTypes.shape({
    icon: PropTypes.string,
    text: PropTypes.node
  })).isRequired,
  isOpen: PropTypes.bool.isRequired,
  setOpen: PropTypes.func.isRequired
}

export default connect(null, mapDispatchToProps)(HardwareWalletModal)

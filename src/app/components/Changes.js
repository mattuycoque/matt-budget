/**
 * In this file, we create a React component
 * which incorporates components provided by Material-UI.
 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import moment from 'moment';

import { withStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardActions from '@material-ui/core/CardActions';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import KeyboardArrowRight from '@material-ui/icons/KeyboardArrowRight';

import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';

import Toolbar from '@material-ui/core/Toolbar';

import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';

import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import MoreVertIcon from '@material-ui/icons/MoreVert';

import Icon from '@material-ui/core/Icon';
import Button from '@material-ui/core/Button';
import ContentAdd from '@material-ui/icons/Add';

import SwapHorizIcon from '@material-ui/icons/SwapHoriz';

import LineGraph from './charts/LineGraph';
import ChangeForm from './changes/ChangeForm';

import ChangeActions from '../actions/ChangeActions';

import { Amount } from './currency/Amount';

const styles = theme => ({
  fab: {
    margin: theme.spacing.unit,
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  cardHeader: {
    background: theme.palette.cardheader
  },
  icon: {
    fontSize: '20px',
  },
  // Legacy
  alignRight: {
    textAlign: 'right',
  },
  actions: {
    width: '20px',
  },
  loading: {
    textAlign: 'center',
    padding: '50px 0',
  },
  grid: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  items: {
    margin: '10px 10px',
    padding: '4px 20px 10px 20px',
    minWidth: '260px',
    flexGrow: '1',
    position: 'relative',
  },
  title: {
    fontSize: '1.6em',
    zIndex: 10,
  },
  graph: {
    position: 'absolute',
    opacity: '0.5',
    bottom: '0%',
    height: '60px',
    left: '50%',
    right: '0px',
    zIndex: 1,
  },
});

const ELEMENT_PER_PAGE = 20;

class Changes extends Component {
  constructor(props) {
    super();
    this.props = props;
    this.history = props.history;
    this.state = {
      changes: null,
      chain: null,
      currencies: null, // List of used currency
      change: null,
      graph: {},
      pagination: ELEMENT_PER_PAGE,
      isLoading: true,
      component: null,
      open: false,
    };
  }

  more = () => {
    this.setState({
      pagination: this.state.pagination + ELEMENT_PER_PAGE,
    });
  };

  handleOpenChange = (change = null) => {
    const component = (
      <ChangeForm
        change={change || this.state.change}
        onSubmit={this.handleCloseChange}
        onClose={this.handleCloseChange}
      />
    );
    this.setState({
      open: true,
      change: change,
      component: component,
    });
  };

  handleCloseChange = () => {
    this.setState({
      change: null,
      open: false,
      component: null,
    });
  };

  handleDuplicateChange = change => {

    let duplicatedItem = {};
    for (var key in change) {
      duplicatedItem[key] = change[key];
    }
    delete duplicatedItem.id;
    delete duplicatedItem.date;

    const component = (
      <ChangeForm
        change={duplicatedItem}
        onSubmit={this.handleCloseChange}
        onClose={this.handleCloseChange}
      />
    );

    this.setState({
      change: duplicatedItem,
      open: true,
      component: component,
    });
  };

  handleDeleteChange = change => {
    this.props.dispatch(ChangeActions.delete(change));
  };

  // Timeout of 350 is used to let perform CSS transition on toolbar
  _updateChange = changes => {
    if (this.timer) {
      // calculate duration
      const duration = new Date().getTime() - this.timer;
      this.timer = null; // reset timer
      if (duration < 350) {
        setTimeout(() => {
          this._performUpdateChange(changes);
        }, 350 - duration);
      } else {
        this._performUpdateChange(changes);
      }
    } else {
      this._performUpdateChange(changes);
    }
  };

  _performUpdateChange = changes => {

    const { selectedCurrency } = this.props;
    changes.list.forEach((change) => {
      change.date = new Date(change.date);
    });
    changes.chain.forEach((change) => {
      change.date = new Date(change.date);
    });

    if (changes && changes.list && Array.isArray(changes.list)) {
      let usedCurrency = [];
      if (changes.chain && changes.chain.length) {
        const arrayOfUsedCurrency = Object.keys(changes.chain[0].rates);
        usedCurrency = this.props.currencies.filter(item => {
          return (
            arrayOfUsedCurrency.indexOf(`${item.id}`) != -1 &&
            item.id != selectedCurrency.id
          );
        });
      }

      let graph = {};

      changes.chain.forEach(block => {
        Object.keys(block.rates).forEach(key => {
          if (key != selectedCurrency.id) {
            let r = block.rates[key][selectedCurrency.id];
            if (!r && block.secondDegree) {
              r = block.secondDegree[key]
                ? block.secondDegree[key][selectedCurrency.id]
                : null;
            }

            if (r) {
              if (!graph[key]) {
                graph[key] = [];
              }
              graph[key].push({ date: block.date, value: 1 / r });
            }
          }
        });
      });

      const currency = usedCurrency.find(c => c.id === parseInt(this.props.match.params.id));
      this.setState({
        changes: changes.chain.filter((item, index) => {
          return Boolean(currency) == false || (item.local_currency === currency.id || item.new_currency === currency.id);
        }),
        chain: changes.chain,
        graph: graph,
        currencies: usedCurrency,
        isLoading: false,
        currency: currency,
      });
    }
  };

  _openActionMenu = (event, item) => {
    this.setState({
      anchorEl: event.currentTarget,
      change: item
    });
  };

  _closeActionMenu = () => {
    this.setState({ anchorEl: null });
  };

  componentWillMount() {
    this._updateChange(this.props.changes);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.selectedCurrency.id != nextProps.selectedCurrency.id ||
        this.props.isSyncing != nextProps.isSyncing) {
      this.setState({
        isLoading: true,
        changes: null,
        chain: null,
        graph: null,
        currencies: null,
      });
    }
    setTimeout(() => this._updateChange(nextProps.changes), 100);
  }

  render() {
    const { anchorEl, open, changes, isLoading } = this.state;
    const { isSyncing, selectedCurrency, currencies, classes } = this.props;

    const tmpCurrency = this.state.currency;

    return [
      <div
        key="modal"
        className={'modalContent ' + (open ? 'open' : 'close') }
      >
        <Card>{this.state.component}</Card>
      </div>,
      <div key="content" className="sideListContent">
        <div className={this.state.id ? 'hideOnMobile column' : 'column'}>
          <Card square className="card" >
            <div className="cardContainer">
              <article>
                <div>
                  <CardHeader
                    title="Changes"
                  />
                  <Divider />
                  <List>
                    <ListItem button
                      selected={Boolean(this.state.currency) === false}
                      onClick={(event) => {
                        this.setState({ currency: null });
                        this.history.push('/changes/');
                      }}
                    >
                      <ListItemText primary="All currencies" secondary={`${this.state.currencies.length} currencies`} />
                      <KeyboardArrowRight  />
                    </ListItem>
                    {changes && this.state.currencies && !isLoading && !isSyncing
                      ? this.state.currencies.map(currency => {
                        return (
                          <ListItem button
                            key={currency.id}
                            selected={Boolean(this.state.currency) && this.state.currency.id === currency.id}
                            onClick={(event) => {
                              this.setState({ currency });
                              this.history.push('/changes/' + currency.id);
                            }}
                          >
                            <ListItemText primary={currency.name} secondary={currency.code} />
                            <KeyboardArrowRight  />
                          </ListItem>
                        );
                      })
                      : '' }
                  </List>
                </div>
              </article>
            </div>
          </Card>
        </div>
        <div className="column">
          { !tmpCurrency ?
            <div className={classes.grid}>
              {changes && this.state.currencies && !isLoading && !isSyncing
                ? this.state.currencies.map(currency => {
                  return (
                    <Card key={currency.id} className={classes.items}>
                      {this.state.chain[0].rates[currency.id][selectedCurrency.id] ? (
                        <div>
                          <h3 className={classes.title}>{currency.name}</h3>
                          <p className={classes.paragraph}>
                            <Amount value={1} currency={currency} /> :{' '}
                            <Amount value={this.state.chain[0].rates[currency.id][selectedCurrency.id]} currency={selectedCurrency} />
                            <br />
                            <strong>
                              <Amount value={1} currency={selectedCurrency} /> :{' '}
                              <Amount value={1 /
                                  this.state.chain[0].rates[currency.id][selectedCurrency.id]} currency={currency} />
                            </strong>
                          </p>
                        </div>
                      ) : (
                        <div>
                          <h3 className={classes.title}>
                            {currency.name}{' '}
                            <small className={classes.notaccurate}>
                              Not accurate
                            </small>
                          </h3>
                          <p className={classes.paragraph}>
                            <Amount value={1} currency={currency} /> :{' '}
                            <Amount value={this.state.chain[0].secondDegree[currency.id][selectedCurrency.id]} currency={selectedCurrency} />

                            <br />
                            <strong>
                              <Amount value={1} currency={selectedCurrency} /> :{' '}
                              <Amount value={1 /
                                this.state.chain[0].secondDegree[currency.id][selectedCurrency.id]} currency={currency} />
                            </strong>
                          </p>
                        </div>
                      )}
                      <div className={classes.graph}>
                        {this.state.graph[currency.id] ? (
                          <LineGraph
                            values={[{ values: this.state.graph[currency.id] }]}
                          />
                        ) : (
                          ''
                        )}
                      </div>
                    </Card>
                  );
                })
                : [
                  'w120',
                  'w150',
                  'w120',
                  'w120',
                  'w120',
                  'w150',
                  'w120',
                  'w120',
                ].map((value, i) => {
                  return (
                    <Card key={i} className={classes.items}>
                      <div>
                        <h3 className={classes.title}>
                          <span className={`loading ${value}`} />
                        </h3>
                        <p className={classes.paragraph}>
                          <span className="loading w50" />{' '}
                          <span className="loading w30" />
                          <br />
                          <strong>
                            <span className="loading w30" />{' '}
                            <span className="loading w50" />
                          </strong>
                        </p>
                      </div>
                      <div className={classes.graph} />
                    </Card>
                  );
                })}
            </div>
            : '' }

          <Toolbar>
            <Button
              color="primary"
              disabled={!changes && !this.state.currencies}
              onClick={() => this.handleOpenChange()}>
              <ContentAdd style={{ marginRight: '6px' }} /> New exchange
            </Button>
          </Toolbar>

          <div style={{ padding: '0 0px 40px 0px' }}>
            <Card className="">
              <CardHeader
                title={ (isLoading || isSyncing ? ' ' : changes.length + ' changes')}
                className={classes.cardHeader}/>

              <Table>
                { tmpCurrency ? <TableHead>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell numeric><Amount value={1} currency={selectedCurrency} /></TableCell>
                    <TableCell numeric><Amount value={1} currency={tmpCurrency} /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead> : '' }
                <TableBody>
                  { changes && this.state.currencies && !isLoading && !isSyncing ?
                    changes.filter((item, index) => {
                      return (
                        !this.state.pagination || index < this.state.pagination
                      );
                    })
                      .map(obj => {

                        const local_currency = currencies.find(c => c.id === obj.local_currency);
                        const new_currency = currencies.find(c => c.id === obj.new_currency);

                        let tmpCurrencyRate,
                          selectedCurrencyRate,
                          tmpCurrencyRateAccurate = true,
                          selectedCurrencyRateAccurate = true;

                        if (tmpCurrency) {
                          if (obj.rates[selectedCurrency.id] && obj.rates[selectedCurrency.id][tmpCurrency.id]) {
                            tmpCurrencyRate = obj.rates[selectedCurrency.id][tmpCurrency.id];
                          } else if (obj.secondDegree[tmpCurrency.id] && obj.secondDegree[tmpCurrency.id][selectedCurrency.id]) {
                            tmpCurrencyRate = 1 / obj.secondDegree[tmpCurrency.id][selectedCurrency.id];
                            tmpCurrencyRateAccurate = false;
                          }
                          if (obj.rates[tmpCurrency.id] && obj.rates[tmpCurrency.id][selectedCurrency.id]) {
                            selectedCurrencyRate = obj.rates[tmpCurrency.id][selectedCurrency.id];
                          } else if (obj.secondDegree[tmpCurrency.id] && obj.secondDegree[tmpCurrency.id][selectedCurrency.id]) {
                            selectedCurrencyRate = obj.secondDegree[tmpCurrency.id][selectedCurrency.id];
                            selectedCurrencyRateAccurate = false;
                          }
                        }

                        return (
                          <TableRow key={obj.id}>
                            <TableCell>
                              { moment(obj.date).format('DD MMM YY') }
                            </TableCell>
                            <TableCell>
                              {obj.name}
                            </TableCell>
                            <TableCell>
                              <Amount value={obj.local_amount} currency={local_currency} />
                              &nbsp;<Icon style={{ verticalAlign: 'bottom' }}><SwapHorizIcon className={classes.icon} /></Icon>&nbsp;
                              <Amount value={obj.new_amount} currency={new_currency} />
                            </TableCell>
                            { tmpCurrency ? <TableCell numeric>
                              <Amount value={tmpCurrencyRate} currency={tmpCurrency} accurate={tmpCurrencyRateAccurate} />
                            </TableCell> : '' }
                            { tmpCurrency ? <TableCell numeric>
                              <Amount value={selectedCurrencyRate} currency={selectedCurrency} accurate={selectedCurrencyRateAccurate} />
                            </TableCell> : '' }
                            <TableCell>
                              <IconButton
                                onClick={(event) => this._openActionMenu(event, obj)}>
                                <MoreVertIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    : ''}
                </TableBody>
              </Table>

              {changes && this.state.pagination < changes.length && !isLoading && !isSyncing ? (
                <CardActions>
                  <Button onClick={this.more} fullWidth={true}>More</Button>
                </CardActions>
              ) : (
                ''
              )}
            </Card>
            <Menu
              anchorEl={ anchorEl }
              open={ Boolean(anchorEl) }
              onClose={this._closeActionMenu}>
              <MenuItem
                onClick={() => {
                  this._closeActionMenu();
                  this.handleOpenChange(this.state.change);
                }}
              >
                Edit
              </MenuItem>
              <MenuItem
                onClick={() => {
                  this._closeActionMenu();
                  this.handleDuplicateChange(this.state.change);
                }}
              >
                Duplicate
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  this._closeActionMenu();
                  this.handleDeleteChange(this.state.change);
                }}
              >
                Delete
              </MenuItem>
            </Menu>

          </div>
        </div>
      </div>,
    ];
  }
}

Changes.propTypes = {
  classes: PropTypes.object.isRequired,
  changes: PropTypes.object.isRequired,
  currencies: PropTypes.array.isRequired,
  account: PropTypes.object.isRequired,
  selectedCurrency: PropTypes.object.isRequired,
  isSyncing: PropTypes.bool.isRequired,
};

const mapStateToProps = (state, ownProps) => {
  return {
    changes: state.changes,
    list: state.changes.list,
    currencies: state.currencies,
    account: state.account,
    isSyncing: state.server.isSyncing,
    selectedCurrency: state.currencies.find((c) => c.id === state.account.currency)
  };
};

export default connect(mapStateToProps)(withStyles(styles)(Changes));

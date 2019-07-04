/**
 * In this file, we create a React component
 * which incorporates components provided by Material-UI.
 */
import React, { Component } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";

import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";

import ExpandMore from "@material-ui/icons/ExpandMore";

import Popover from "@material-ui/core/Popover";

import AccountsActions from "../../actions/AccountsActions";

const styles = {
  list: {
    padding: 0
  }
};

class AccountSelector extends Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
      anchorEl: null,
      disabled: props.disabled
    };
  }

  handleOpen = event => {
    const { onClick } = this.props;
    // Propagate onClick action to parent element
    if (onClick) {
      onClick();
    }

    // This prevents ghost click.
    event.preventDefault();
    this.setState({
      open: true,
      anchorEl: event.currentTarget
    });
  };

  handleRequestClose = () => {
    this.setState({
      open: false
    });
  };

  handleChange = account => {
    const { dispatch, onChange } = this.props;
    // Propagate onClick action to parent element
    if (onChange) {
      onChange();
    }

    dispatch(AccountsActions.switchAccount(account));

    this.setState({
      open: false
    });
  };

  componentWillReceiveProps(newProps) {
    this.setState({
      disabled: newProps.disabled
    });
  }

  render() {
    const { anchorEl, open, disabled } = this.state;
    const { account, accounts, className, server } = this.props;

    return (
      <div className={className}>
        {account ? (
          <div>
            <List style={styles.list}>
              <ListItem
                button
                ref={node => {
                  this.target1 = node;
                }}
                aria-owns={open ? "menu-list-grow" : null}
                aria-haspopup="true"
                disabled={disabled}
                onClick={this.handleOpen}
              >
                <ListItemText>{account.name}</ListItemText>
                <ExpandMore color="action" />
              </ListItem>
            </List>

            <Popover
              id={open ? "long-menu" : null}
              open={open}
              onClose={this.handleRequestClose}
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "left"
              }}
              PaperProps={{
                style: {
                  maxHeight: "70vh",
                  width: 200
                }
              }}
            >
              <List style={{ paddingTop: 0, marginTop: 0 }}>
                <ListSubheader disableSticky={true}>
                  {server.name}
                </ListSubheader>
                {accounts.map(item => (
                  <ListItem
                    key={item.id}
                    onClick={() => {
                      this.handleChange(item);
                    }}
                    selected={account.id === item.id}
                    button
                  >
                    <ListItemText primary={item.name} />
                  </ListItem>
                ))}
              </List>
            </Popover>
          </div>
        ) : (
          ""
        )}
      </div>
    );
  }
}

AccountSelector.propTypes = {
  dispatch: PropTypes.func.isRequired,
  account: PropTypes.object.isRequired,
  accounts: PropTypes.array.isRequired,
  server: PropTypes.object.isRequired
};

const mapStateToProps = (state, ownProps) => {
  return {
    account: state.account,
    accounts: state.accounts.remote,
    server: state.server
  };
};

export default connect(mapStateToProps)(AccountSelector);

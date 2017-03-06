import React, { Component } from 'react'
import cx from 'classnames'
import './App.css'
import Chat from './Chat'
import ChatHeader from './ChatHeader'
import ConversationsList from './ConversationsList'
import ConversationsListHeader from './ConversationsListHeader'
import { graphql, compose, withApollo } from 'react-apollo'
import gql from 'graphql-tag'
import generateStupidName from 'sillyname'

const TEST_WITH_NEW_CUSTOMER = false
const FREECOM_CUSTOMER_ID_KEY = 'FREECOM_CUSTOMER_ID'
const FREECOM_CUSTOMER_NAME_KEY = 'FREECOM_CUSTOMER_NAME'

const createCustomer = gql`
  mutation createCustomer($name: String!) {
    createCustomer(name: $name) {
      id
      name
    }
  }
`

const createCustomerAndConversation = gql`
  mutation createCustomer($name: String!, $slackChannelName: String!) {
    createCustomer(name: $name, conversations: [{
    slackChannelName: $slackChannelName,
    }]) {
      id
      conversations {
        id
        updatedAt
        slackChannelName
      }
    }
  }
`

const findConversations = gql`
  query allConversations($customerId: ID!) {
    allConversations(filter: {
      customer: {
        id: $customerId
      }
    }){
      id
      updatedAt
      slackChannelName
      agent {
        id
        slackUserName
      }
      messages(last: 1) {
        id
        text
        createdAt
      }
    }
  }
`

const createConversation = gql`
  mutation createConversation($customerId: ID!, $slackChannelName: String!) {
    createConversation(customerId: $customerId, slackChannelName: $slackChannelName) {
      id
      updatedAt
      slackChannelName
      agent {
        id
        slackUserName
      }
      messages(last: 1) {
        id
        text
        createdAt
      }
    }
  }
`


class App extends Component {

  state = {
    selectedConversationId: null,
    conversations: [],
    displayState: 'CONVERSATIONS', // 'CONVERSATIONS' or 'CHAT'
    isOpen: true,
  }

  async componentDidMount() {

    // TESTING
    if (TEST_WITH_NEW_CUSTOMER) {
      localStorage.removeItem(FREECOM_CUSTOMER_ID_KEY)
      localStorage.removeItem(FREECOM_CUSTOMER_NAME_KEY)
    }

    const customerId = localStorage.getItem(FREECOM_CUSTOMER_ID_KEY)
    const username = localStorage.getItem(FREECOM_CUSTOMER_NAME_KEY)

    if (Boolean(customerId) && Boolean(username)) {

      // customer already exists, find all conversations for that customer
      const findConversationsResult = await this.props.client.query({
        query: findConversations,
        variables: {
          customerId
        }
      })

      this.setState({conversations: findConversationsResult.data.allConversations})

    }
    else {
      // customer doesn't exist yet, create customer and conversation
      const username = this._generateShortStupidName()
      const result = await this.props.createCustomerMutation({
        variables: {
          name: username,
        }
      })
      const customerId = result.data.createCustomer.id
      localStorage.setItem(FREECOM_CUSTOMER_ID_KEY, customerId)
      localStorage.setItem(FREECOM_CUSTOMER_NAME_KEY, username)
    }

  }

  render() {

    const customerId = localStorage.getItem(FREECOM_CUSTOMER_ID_KEY)
    const customerExists = Boolean(customerId)
    const conversationExists = Boolean(this.state.selectedConversationId)
    const panelStyles = cx('panel drop-shadow radius overflow-hidden', {
      'hide': !this.state.isOpen,
      'fadeInUp':this.state.isOpen,
    })

    return (
      <div className='App'>
        {
          !conversationExists ?
            Boolean(this.state.conversations) &&
            this._conversationsList(panelStyles)
            :
            customerExists &&
            this._chat(panelStyles, customerId)
        }
      </div>
    )
  }

  _conversationsList = (panelStyles) => {
    return (
      <div>
        <div className='container'>
          <div className={panelStyles}>
            <ConversationsListHeader
              togglePanel={this._togglePanel}
            />
            <div className='body overflow-scroll'>
              <ConversationsList
                conversations={this.state.conversations}
                onSelectConversation={this._onSelectConversation}
              />
              <div className='flex flex-hcenter full-width conversation-button-wrapper pointer-events-none'>
                <div
                  className='conversation-button background-darkgray drop-shadow-hover pointer flex-center flex pointer-events-initial'
                  onClick={() => this._initiateNewConversation()}
                >
                  <p>New Conversation</p>
                </div>
              </div>
            </div>
          </div>
          <div
            className='button drop-shadow-hover pointer'
            onClick={() => this._togglePanel()}
          />
        </div>
      </div>
    )
  }

  _chat = (panelStyles, customerId) => {

    const selectedConversation = this.state.conversations.find(conversation => {
      return conversation.id === this.state.selectedConversationId
    })

    const chatPartnerName = selectedConversation.agent ?
      selectedConversation.agent.slackUserName : global['Freecom'].companyName

    return (
      <div>
        <div className='container'>
          <div className={panelStyles}>
            <ChatHeader
              chatPartnerName={chatPartnerName}
              resetConversation={this._resetConversation}
            />
            <Chat
              conversationId={this.state.selectedConversationId}
              customerId={customerId}
              resetConversation={this._resetConversation}
              updateLastMessage={this._updateLastMessageInConversation}
            />
          </div>
          <div className='button pointer drop-shadow-hover' onClick={() => this._togglePanel()}></div>
        </div>
      </div>
    )
  }

  _updateLastMessageInConversation = (conversationId, newLastMessage) => {
    const newConversations = this.state.conversations.slice()
    const indexOfConversationToUpdate = newConversations.findIndex(conversation => {
      return conversation.id === conversationId
    })
    const newConversation = {
      ...newConversations[indexOfConversationToUpdate],
      messages: [newLastMessage]
    }
    newConversations[indexOfConversationToUpdate] = newConversation
    this.setState({conversations: newConversations})
  }

  _togglePanel = () => this.setState({isOpen: !this.state.isOpen})

  _initiateNewConversation = () => {

    const customerId = localStorage.getItem(FREECOM_CUSTOMER_ID_KEY)
    const username = localStorage.getItem(FREECOM_CUSTOMER_NAME_KEY)

    const emptyConversation = this.state.conversations.find(conversation => {
      return conversation.messages.length === 0
    })

    if (Boolean(emptyConversation)) {
      this.setState({selectedConversationId: emptyConversation.id})
    }
    else {
      this._createNewConversation(customerId, username)
    }
  }

  _createNewConversation = async (customerId, username) => {

    // find channel with greatest position appended as suffix
    const channelPositions = this.state.conversations.map(conversation => {
      const slackChannelNameComponents = conversation.slackChannelName.split('-')
      return slackChannelNameComponents[slackChannelNameComponents.length-1]
    })

    let newChannelPosition = 1
    if (channelPositions.length > 0) {
      const maxPosition = Math.max.apply(null, channelPositions)
      newChannelPosition = maxPosition + 1
    }
    const newChannelName = (username + '-' + newChannelPosition).toLowerCase()

    // create new conversation for the customer
    console.debug('Create conversation for existing customer: ', customerId, newChannelName)
    const result = await this.props.createConversationMutation({
      variables: {
        customerId: customerId,
        slackChannelName: newChannelName
      }
    })
    const conversationId = result.data.createConversation.id
    const newConversations = this.state.conversations.concat([result.data.createConversation])
    this.setState({
      conversations: newConversations,
      selectedConversationId: conversationId,
    })
  }

  _onSelectConversation = (conversation) => {
    console.debug('Selected conversation: ', conversation)
    this.setState({
      selectedConversationId: conversation.id,
    })
  }

  _resetConversation = () => {
    this.setState({
      selectedConversationId: null,
    })
  }

  _generateShortStupidName = () => {
    const maxLength = 17
    const username = generateStupidName()
    if (username.length > maxLength) {
      return this._generateShortStupidName()
    }
    const usernameWithoutSpace = username.replace(' ', '-')
    return usernameWithoutSpace
  }

}

const appWithMutations = compose(
  graphql(createConversation, {name : 'createConversationMutation'}),
  graphql(createCustomer, {name: 'createCustomerMutation'}),
  graphql(createCustomerAndConversation, {name: 'createCustomerAndConversationMutation'})
)(App)

export default withApollo(appWithMutations)

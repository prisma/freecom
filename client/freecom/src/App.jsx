import React, { Component } from 'react'
import './App.css'
import Chat from './Chat'
import ConversationsList from './ConversationsList'
import { graphql, compose, withApollo } from 'react-apollo'
import gql from 'graphql-tag'
import generateStupidName from 'sillyname'

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
        }
    }
`

const createConversation = gql`
    mutation createConversation($customerId: ID!, $slackChannelName: String!) {
        createConversation(customerId: $customerId, slackChannelName: $slackChannelName) {
            id
            updatedAt
        }
    }
`

const FREECOM_CUSTOMER_ID_KEY = 'FREECOM_CUSTOMER_ID'
const FREECOM_CUSTOMER_NAME_KEY = 'FREECOM_CUSTOMER_NAME'

class App extends Component {

  state = {
    conversationId: null,
    conversations: [],
    displayState: 'CONVERSATIONS' // 'CONVERSATIONS' or 'CHAT'
  }

  async componentDidMount() {

    // TESTING
    // localStorage.removeItem(FREECOM_CUSTOMER_ID_KEY)
    // localStorage.removeItem(FREECOM_CUSTOMER_NAME_KEY)

    const customerId = localStorage.getItem(FREECOM_CUSTOMER_ID_KEY)
    const username = localStorage.getItem(FREECOM_CUSTOMER_NAME_KEY)

    console.log('Got customer Id from local storage: ', customerId)
    if (Boolean(customerId) && Boolean(username)) {

      // customer already exists, find all conversations for that customer
      const findConversationsResult = await this.props.client.query({
        query: findConversations,
        variables: {
          customerId
        }
      })

      console.log('Find conversations result: ', findConversationsResult)
      this.setState({conversations: findConversationsResult.data.allConversations})

      // find channel with greatest position appended as suffix
      const channelPositions = findConversationsResult.data.allConversations.map(conversation => {
        const slackChannelNameComponents = conversation.slackChannelName.split('-')
        return slackChannelNameComponents[slackChannelNameComponents.length-1]
      })

      console.log('Channel positions: ', channelPositions)

      const maxPosition = Math.max.apply(null, channelPositions)
      const newChannelPosition = maxPosition + 1
      const newChannelName = username + '-' + newChannelPosition

      // create new conversation for the customer
      console.log('Create conversation for existing customer: ', customerId, newChannelName)
      const result = await this.props.createConversationMutation({
        variables: {
          customerId: customerId,
          slackChannelName: newChannelName
        }
      })
      const conversationId = result.data.createConversation.id
      // this.setState({conversationId})
    }
    else {
      // customer doesn't exist yet, create customer and conversation
      const username = this._generateShortStupidName()
      const slackChannelName = username + '-' + '0'
      const result = await this.props.createCustomerAndConversationMutation({
        variables: {
          name: username,
          slackChannelName
        }
      })
      console.log('Did create new customer: ', result.data)
      const customerId = result.data.createCustomer.id
      localStorage.setItem(FREECOM_CUSTOMER_ID_KEY, customerId)
      localStorage.setItem(FREECOM_CUSTOMER_NAME_KEY, username)
      const conversationId = result.data.createCustomer.conversations[0].id
      // this.setState({conversationId})
    }

  }

  render() {

    const customerId = localStorage.getItem(FREECOM_CUSTOMER_ID_KEY)
    const customerExists = Boolean(customerId)
    const conversationExists = Boolean(this.state.conversationId)

    console.log('App - render - ', customerId, this.state.conversationId)

    return (
      <div className='App'>
        <div className='App-header'>
          <h2>Welcome to Freecom - Type a message</h2>
        </div>
        {!conversationExists ?
          Boolean(this.state.conversations) &&
          <ConversationsList
            conversations={this.state.conversations}
            onSelectConversation={this._onSelectConversation}
          />
          :
          customerExists &&
          <Chat
            conversationId={this.state.conversationId}
            customerId={customerId}
            resetConversation={this._resetConversation}
          />
        }

      </div>
    )
  }

  _onSelectConversation = (conversation) => {
    console.log('Selected conversation: ', conversation)
    this.setState({
      conversationId: conversation.id,
    })
  }

  _resetConversation = () => {
    this.setState({
      conversationId: null,
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
  graphql(createCustomerAndConversation, {name: 'createCustomerAndConversationMutation'})
)(App)

export default withApollo(appWithMutations)

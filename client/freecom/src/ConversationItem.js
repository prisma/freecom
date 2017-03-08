import React, { Component} from 'react'
import './ConversationItem.css'
import { timeDifference } from './utils'

class ConversationItem extends Component {

  static propTypes = {
    conversation: React.PropTypes.any.isRequired,
    onSelectConversation: React.PropTypes.func.isRequired,
  }

  render() {

    const lastMessage = this.props.conversation.messages[0]
    let ago
    let message
    if (lastMessage) {
      const createdAtTimestamp = new Date(lastMessage.createdAt).getTime()
      const nowTimestamp = new Date().getTime()
      ago = timeDifference(nowTimestamp, createdAtTimestamp)
      message = lastMessage.text.split('').length > 32 ?
        lastMessage.text.split('').splice(0,32).join('') + '...' :
        lastMessage.text
    } else {
      ago = ''
      message = 'Start a new conversation'
    }

    const chatPartnerName = this.props.conversation.agent ?
      this.props.conversation.agent.slackUserName :
      global['Freecom'].companyName

    const profileImageUrl =  this.props.conversation.agent && this.props.conversation.agent.imageUrl ?
      this.props.conversation.agent.imageUrl :
      global['Freecom'].companyLogoURL

    return (
      <div
        className='conversation interior-padding fadeInLeft pointer hover-gray'
        onClick={() => this.props.onSelectConversation(this.props.conversation)}
      >
        <div className='flex'>
          <img
            src={profileImageUrl}
            alt=''
            className='avatar'></img>
          <div className='conversation-text-padding full-width'>
            <div className='flex'>
              <p className='full-width opacity-6'>{chatPartnerName}</p>
              <p className='opaque conversation-ago'>{ago}</p>
            </div>
            <p className='full-width opacity-8'>{message}</p>
          </div>
        </div>
      </div>
    )
  }

}

export default ConversationItem

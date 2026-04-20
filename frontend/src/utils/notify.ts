import { message } from 'antd'

const DURATION = 2

export const notify = {
  success(content: string) {
    message.open({
      type: 'success',
      content,
      duration: DURATION
    })
  },
  warning(content: string) {
    message.open({
      type: 'warning',
      content,
      duration: DURATION
    })
  },
  error(content: string) {
    message.open({
      type: 'error',
      content,
      duration: DURATION
    })
  },
  info(content: string) {
    message.open({
      type: 'info',
      content,
      duration: DURATION
    })
  }
}


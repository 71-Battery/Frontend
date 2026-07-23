import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const markdownPlugins = [remarkGfm]

const markdownComponents = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  img: ({ alt }) => (
    <span className="markdown-image-placeholder">
      {alt ? `[이미지: ${alt}]` : '[이미지]'}
    </span>
  ),
}

function MarkdownMessage({ content }) {
  return (
    <div className="message-markdown">
      <ReactMarkdown
        remarkPlugins={markdownPlugins}
        components={markdownComponents}
        skipHtml
      >
        {String(content || '')}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownMessage

import { useEffect, useState, type FormEvent } from 'react'

type ChatResponse = {
  answer: string
  evidence: string[]
  actions?: string[]
  support_applied?: boolean
  intake_item_id?: number | null
  support_state?: string
  intent_clear?: boolean | null
  next_action?: string
}

type ChatMessage = {
  role: 'user' | 'bot'
  content: string
  evidence?: string[]
  actions?: string[]
  supportState?: string
  nextAction?: string
  intakeItemId?: number | null
}

type ChatWidgetProps = {
  token: string | null
  busy: boolean
  onChat: (question: string) => Promise<ChatResponse>
  supportRequest?: { key: string; intakeItemId: number; title: string } | null
  onIntakeSupport?: (intakeItemId: number, question?: string) => Promise<ChatResponse>
  onSupportApplied?: (intakeItemId: number) => Promise<void> | void
}

export function ChatWidget({ token, busy, onChat, supportRequest, onIntakeSupport, onSupportApplied }: ChatWidgetProps) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [supportContext, setSupportContext] = useState<{ intakeItemId: number; title: string } | null>(null)
  const [supportNavState, setSupportNavState] = useState<{
    intakeItemId: number | null
    supportState: string
    nextAction: string
    canProceed: boolean
  }>({
    intakeItemId: null,
    supportState: 'general',
    nextAction: 'none',
    canProceed: false,
  })

  async function recreateUnderstandingReview() {
    if (!supportContext || !onIntakeSupport || !token || isTyping) return
    const resolutionPrompt =
      'Go to Understanding Review and regenerate understanding with the available document evidence.'
    setIsTyping(true)
    setChatHistory((prev) => [
      ...prev,
      { role: 'user', content: resolutionPrompt },
      { role: 'bot', content: '' },
    ])
    try {
      const response = await onIntakeSupport(supportContext.intakeItemId, resolutionPrompt)
      setChatHistory((prev) => {
        const next = [...prev]
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].role === 'bot' && next[i].content === '') {
            next[i] = {
              role: 'bot',
              content: response.answer,
              evidence: response.evidence,
              actions: response.actions || [],
              supportState: response.support_state || 'general',
              nextAction: response.next_action || 'none',
              intakeItemId: response.intake_item_id ?? null,
            }
            return next
          }
        }
        return next
      })
      const canProceed = Boolean(
        response.intake_item_id &&
        response.intent_clear &&
        response.next_action === 'approve_understanding',
      )
      setSupportNavState({
        intakeItemId: response.intake_item_id ?? supportContext.intakeItemId,
        supportState: response.support_state || 'general',
        nextAction: response.next_action || 'none',
        canProceed,
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error'
      setChatHistory((prev) => {
        const next = [...prev]
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].role === 'bot' && next[i].content === '') {
            next[i] = { role: 'bot', content: `Could not recreate understanding review: ${reason}` }
            return next
          }
        }
        return next
      })
    } finally {
      setIsTyping(false)
    }
  }

  // Add bot response to history when received
  useEffect(() => {
    if (isTyping && chatHistory.length > 0) {
      const lastMessage = chatHistory[chatHistory.length - 1]
      if (lastMessage.role === 'bot' && lastMessage.content === '') {
        // This is a typing indicator, will be replaced when response arrives
      }
    }
  }, [chatHistory, isTyping])

  useEffect(() => {
    if (!supportRequest || !onIntakeSupport || !token) return

    let alive = true
    setIsChatOpen(true)
    setSupportContext({ intakeItemId: supportRequest.intakeItemId, title: supportRequest.title })
    setSupportNavState({
      intakeItemId: supportRequest.intakeItemId,
      supportState: 'blocked_unclear_intent',
      nextAction: 'resolve_intent',
      canProceed: false,
    })
    setIsTyping(true)
    setChatHistory((prev) => [
      ...prev,
      {
        role: 'bot',
        content: `Intake support triggered for "${supportRequest.title}". Checking root cause and recommended recovery path...`,
      },
      { role: 'bot', content: '' },
    ])

    void onIntakeSupport(supportRequest.intakeItemId)
      .then((response) => {
        if (!alive) return
        setChatHistory((prev) => {
          const next = [...prev]
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i].role === 'bot' && next[i].content === '') {
              next[i] = {
                role: 'bot',
                content: response.answer,
                evidence: response.evidence,
                actions: response.actions || [],
                supportState: response.support_state || 'general',
                nextAction: response.next_action || 'none',
                intakeItemId: response.intake_item_id ?? null,
              }
              return next
            }
          }
          next.push({
            role: 'bot',
            content: response.answer,
            evidence: response.evidence,
            actions: response.actions || [],
            supportState: response.support_state || 'general',
            nextAction: response.next_action || 'none',
            intakeItemId: response.intake_item_id ?? null,
          })
          return next
        })
        const canProceed = Boolean(
          response.intake_item_id &&
          response.intent_clear &&
          response.next_action === 'approve_understanding',
        )
        setSupportNavState({
          intakeItemId: response.intake_item_id ?? supportRequest.intakeItemId,
          supportState: response.support_state || 'general',
          nextAction: response.next_action || 'none',
          canProceed,
        })
      })
      .catch((err) => {
        const reason = err instanceof Error ? err.message : 'Unknown error'
        if (!alive) return
        setChatHistory((prev) => {
          const next = [...prev]
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i].role === 'bot' && next[i].content === '') {
              next[i] = {
                role: 'bot',
                content: `Support assistant diagnostics failed: ${reason}`,
              }
              return next
            }
          }
          return [...next, { role: 'bot', content: `Support assistant diagnostics failed: ${reason}` }]
        })
      })
      .finally(() => {
        if (alive) setIsTyping(false)
      })

    return () => {
      alive = false
    }
  }, [supportRequest?.key, supportRequest, onIntakeSupport, onSupportApplied, token])

  async function handleChatSubmit(e: FormEvent) {
    e.preventDefault()
    if (!question.trim() || !token) return

    // Add user message to history
    const userMessage: ChatMessage = { role: 'user', content: question }
    setChatHistory(prev => [...prev, userMessage])

    // Clear input and show typing indicator
    const currentQuestion = question
    setQuestion('')
    setIsTyping(true)

    // Add typing indicator placeholder
    setChatHistory(prev => [...prev, { role: 'bot', content: '' }])

    try {
      // Call the chat API
      const response =
        supportContext && onIntakeSupport
          ? await onIntakeSupport(supportContext.intakeItemId, currentQuestion)
          : await onChat(currentQuestion)

      // Replace typing indicator with actual response
      setChatHistory(prev => {
        const newHistory = [...prev]
        const lastIndex = newHistory.length - 1
        newHistory[lastIndex] = {
          role: 'bot',
          content: response.answer,
          evidence: response.evidence,
          actions: response.actions || [],
          supportState: response.support_state || 'general',
          nextAction: response.next_action || 'none',
          intakeItemId: response.intake_item_id ?? null,
        }
        return newHistory
      })
      if (supportContext) {
        const canProceed = Boolean(
          response.intake_item_id &&
          response.intent_clear &&
          response.next_action === 'approve_understanding',
        )
        setSupportNavState({
          intakeItemId: response.intake_item_id ?? supportContext.intakeItemId,
          supportState: response.support_state || 'general',
          nextAction: response.next_action || 'none',
          canProceed,
        })
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error'
      // Show error message
      setChatHistory(prev => {
        const newHistory = [...prev]
        const lastIndex = newHistory.length - 1
        newHistory[lastIndex] = {
          role: 'bot',
          content: `Support assistant request failed: ${reason}`
        }
        return newHistory
      })
    } finally {
      setIsTyping(false)
    }
  }

  const suggestions = [
    'What is delayed status?',
    'Show high priority items',
    'What are the risks?',
    'Show roadmap progress'
  ]

  return (
    <div className="chat-widget-container">
      <div className={`chat-widget ${isChatOpen ? 'open' : 'closed'}`}>
        <div className="chat-widget-header">
          <h3>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 6C13.66 6 15 7.34 15 9C15 10.66 13.66 12 12 12C10.34 12 9 10.66 9 9C9 7.34 10.34 6 12 6ZM12 18.2C9.5 18.2 7.29 16.92 6 15.01C6.03 12.99 10 11.9 12 11.9C13.99 11.9 17.97 12.99 18 15.01C16.71 16.92 14.5 18.2 12 18.2Z"/>
            </svg>
            Roadmap Assistant
            {supportContext && <span className="chat-context-pill">Intake Support</span>}
          </h3>
          <button
            className="chat-close-btn"
            onClick={() => {
              setIsChatOpen(false)
              setSupportContext(null)
            }}
            aria-label="Close chat"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"/>
            </svg>
          </button>
        </div>

        <div className="chat-widget-messages">
          {chatHistory.length === 0 ? (
            <div className="chat-widget-empty">
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z"/>
              </svg>
              <h4>Ask me anything</h4>
              <p>I can help you with roadmap status, delays, priorities, and more.</p>
              <div className="chat-widget-suggestions">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    className="chat-suggestion-chip"
                    onClick={() => setQuestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>
                {msg.role === 'bot' && msg.content === '' ? (
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: 0 }}>{msg.content}</p>
                    {msg.actions && msg.actions.length > 0 && (
                      <ul className="chat-message-actions">
                        {msg.actions.map((action, idx) => (
                          <li key={`${action}-${idx}`}>{action}</li>
                        ))}
                      </ul>
                    )}
                    {msg.evidence && msg.evidence.length > 0 && (
                      <div className="chat-message-evidence">
                        <strong>Evidence:</strong> {msg.evidence.join(', ')}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {supportContext && onSupportApplied && (
          <div className="chat-support-transition">
            <button
              type="button"
              className="ghost-btn tiny"
              disabled={busy || isTyping || !supportContext || supportNavState.canProceed}
              onClick={() => {
                void recreateUnderstandingReview()
              }}
            >
              Recreate Understanding Review
            </button>
            <button
              type="button"
              className="chat-support-transition-btn"
              disabled={
                busy ||
                isTyping ||
                !supportNavState.canProceed ||
                !supportNavState.intakeItemId ||
                supportNavState.nextAction !== 'approve_understanding'
              }
              onClick={() => {
                if (!supportNavState.intakeItemId) return
                void onSupportApplied(supportNavState.intakeItemId)
                setSupportContext(null)
                setIsChatOpen(false)
                setSupportNavState({
                  intakeItemId: null,
                  supportState: 'general',
                  nextAction: 'none',
                  canProceed: false,
                })
              }}
            >
              Go to Understanding Review
            </button>
            <p className="chat-support-transition-hint">
              {supportNavState.canProceed
                ? 'Intent is clear. You can now approve understanding.'
                : 'If intent is still unclear, click Recreate Understanding Review to run guided support resolution.'}
            </p>
          </div>
        )}

        <form className="chat-widget-input" onSubmit={handleChatSubmit}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about status, delays, progress..."
            disabled={busy || isTyping}
          />
          <button
            type="submit"
            disabled={busy || isTyping || !question.trim()}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z"/>
            </svg>
          </button>
        </form>
      </div>

      <button
        className="chat-toggle-btn"
        onClick={() => setIsChatOpen(!isChatOpen)}
        aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
      >
        {isChatOpen ? (
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM18 14H6V12H18V14ZM18 11H6V9H18V11ZM18 8H6V6H18V8Z"/>
          </svg>
        )}
      </button>
    </div>
  )
}

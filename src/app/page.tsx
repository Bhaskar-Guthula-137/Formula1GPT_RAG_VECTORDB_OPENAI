'use client'

import { useChat } from '@ai-sdk/react'
import { Send, User, Bot, Flag, Loader2, Database, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useEffect, useRef, useState } from 'react'

type RagMatch = { score: number; preview: string }
type RagStats = { available: boolean; chunks: number; matches: RagMatch[]; note?: string }

export default function F1GPT() {
	const { messages, sendMessage, status } = useChat({ api: '/api/chat' })
	const [input, setInput] = useState('')
	const [ragStats, setRagStats] = useState<RagStats | null>(null)
	const [ragExpanded, setRagExpanded] = useState(false)
	const [cooldown, setCooldown] = useState(0)   // seconds remaining
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const isLoading = status === 'submitted' || status === 'streaming'

	// tick the cooldown counter down every second
	useEffect(() => {
		if (cooldown <= 0) return
		const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
		return () => clearTimeout(t)
	}, [cooldown])

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	const handleSend = async () => {
		const text = input.trim()
		if (!text || isLoading || cooldown > 0) return
		setInput('')
		setRagStats(null)
		setRagExpanded(false)

		// Fetch RAG stats in parallel — doesn't block the chat response
		fetch('/api/rag-stats', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query: text }),
		})
			.then((r) => r.json())
			.then(setRagStats)
			.catch(() => {})

		try {
			await sendMessage({ text })
		} catch (err: any) {
			// Parse 429 rate limit response
			const body = err?.message ? tryParseJson(err.message) : null
			if (body?.resetIn) {
				setCooldown(body.resetIn)
			}
		}
	}

	const tryParseJson = (str: string) => { try { return JSON.parse(str) } catch { return null } }

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSend()
		}
	}

	const getMessageText = (message: (typeof messages)[0]) => {
		return message.parts
			.filter((p) => p.type === 'text')
			.map((p) => (p as { type: 'text'; text: string }).text)
			.join('')
	}

	return (
		<div className="flex flex-col min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-600 selection:text-white">
			{/* Header */}
			<header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10">
				<div className="flex items-center gap-3">
					<div className="p-2 bg-red-600 rounded-lg">
						<Flag className="w-6 h-6 text-white" />
					</div>
					<h1 className="text-2xl font-black tracking-tighter uppercase italic">
						F1 <span className="text-red-600">GPT</span>
					</h1>
				</div>
				<div className="text-xs font-medium text-white/40 uppercase tracking-widest">
					RAG-powered
				</div>
			</header>

			{/* Chat Area */}
			<main className="flex-1 overflow-y-auto px-4 py-8 md:px-0">
				<div className="max-w-3xl mx-auto space-y-8">
					{messages.length === 0 ? (
						<div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
							<div className="p-6 bg-white/5 rounded-full border border-white/10 animate-pulse">
								<Flag className="w-12 h-12 text-red-600" />
							</div>
							<div className="space-y-2">
								<h2 className="text-3xl font-bold tracking-tight">Gentlemen, start your engines.</h2>
								<p className="text-white/40 max-w-sm mx-auto">
									Ask me anything about Formula One, from technical specs to the latest race results.
								</p>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg mt-8">
								{['Who won the last Grand Prix?', 'Explain DRS in F1', 'Current Driver Standings', 'Technical changes for 2026'].map((suggestion) => (
									<button
										key={suggestion}
										onClick={() => setInput(suggestion)}
										className="p-4 text-left text-sm bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-red-600/50 transition-all cursor-pointer"
									>
										{suggestion}
									</button>
								))}
							</div>
						</div>
					) : (
						messages.map((message, i) => (
							<div key={message.id}>
								<div className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
									<div className={`flex max-w-[85%] gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
										<div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${
											message.role === 'user' ? 'bg-red-600 border-red-500' : 'bg-white/5 border-white/10'
										}`}>
											{message.role === 'user' ? (
												<User className="w-4 h-4 text-white" />
											) : (
												<Bot className="w-4 h-4 text-red-600" />
											)}
										</div>
										<div className={`p-4 rounded-2xl ${
											message.role === 'user'
												? 'bg-red-600 text-white rounded-tr-none'
												: 'bg-white/5 border border-white/10 text-white/90 rounded-tl-none prose prose-invert max-w-none'
										}`}>
											<ReactMarkdown>{getMessageText(message)}</ReactMarkdown>
										</div>
									</div>
								</div>

								{/* RAG metrics badge — shown after the last assistant message */}
								{message.role === 'assistant' && i === messages.length - 1 && ragStats && (
									<div className="mt-3 ml-12">
										<button
											onClick={() => setRagExpanded((v) => !v)}
											className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs"
										>
											<Database className="w-3 h-3 text-red-500" />
											{ragStats.available ? (
												<span className="text-white/70">
													<span className="text-white font-semibold">{ragStats.chunks}</span> vector{ragStats.chunks !== 1 ? 's' : ''} retrieved
												</span>
											) : (
												<span className="text-white/40">Vectorize not available locally</span>
											)}
											{ragStats.available && ragStats.chunks > 0 && (
												ragExpanded ? <ChevronUp className="w-3 h-3 text-white/40" /> : <ChevronDown className="w-3 h-3 text-white/40" />
											)}
										</button>

										{ragExpanded && ragStats.available && ragStats.chunks > 0 && (
											<div className="mt-2 space-y-1.5 border border-white/10 rounded-xl overflow-hidden">
												{ragStats.matches.map((m, idx) => (
													<div key={idx} className="flex gap-3 px-3 py-2 bg-white/5 text-xs">
														<span className={`font-mono font-bold flex-shrink-0 ${
															m.score >= 0.8 ? 'text-green-400' : m.score >= 0.6 ? 'text-yellow-400' : 'text-white/40'
														}`}>
															{m.score.toFixed(3)}
														</span>
														<span className="text-white/50 truncate">{m.preview}…</span>
													</div>
												))}
											</div>
										)}
									</div>
								)}
							</div>
						))
					)}

					{isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
						<div className="flex gap-4 justify-start">
							<div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
								<Bot className="w-4 h-4 text-red-600" />
							</div>
							<div className="p-4 rounded-2xl bg-white/5 border border-white/10 rounded-tl-none">
								<Loader2 className="w-5 h-5 animate-spin text-red-600" />
							</div>
						</div>
					)}
					<div ref={messagesEndRef} />
				</div>
			</main>

			{/* Input Area */}
			<footer className="sticky bottom-0 p-6 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
				{cooldown > 0 && (
					<div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
						<Clock className="w-4 h-4 flex-shrink-0" />
						<span>Rate limit reached. Try again in <span className="font-bold">{cooldown}s</span></span>
						<div className="ml-auto h-1 flex-1 max-w-24 bg-white/10 rounded-full overflow-hidden">
							<div
								className="h-full bg-yellow-500 rounded-full transition-all duration-1000"
								style={{ width: `${(cooldown / 60) * 100}%` }}
							/>
						</div>
					</div>
				)}
				<div className="max-w-3xl mx-auto relative">
					<input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={cooldown > 0}
						placeholder={cooldown > 0 ? `Rate limited — wait ${cooldown}s` : 'Type your message about F1...'}
						className="w-full p-4 pr-16 bg-white/10 border border-white/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-red-600/70 focus:border-red-600 transition-all placeholder:text-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
					/>
					<button
						onClick={handleSend}
						disabled={isLoading || !input.trim() || cooldown > 0}
						className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/20 transition-all"
					>
						<Send className="w-5 h-5" />
					</button>
				</div>
				<p className="mt-4 text-center text-[10px] text-white/20 uppercase tracking-widest font-bold">
					F1 GPT can make mistakes. Verify critical stats.
				</p>
			</footer>
		</div>
	)
}

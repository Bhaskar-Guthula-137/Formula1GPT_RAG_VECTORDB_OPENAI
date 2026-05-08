'use client'

import { useChat } from '@ai-sdk/react'
import { Send, User, Bot, Flag, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useEffect, useRef, useState } from 'react'

export default function F1GPT() {
	const { messages, sendMessage, status } = useChat({ api: '/api/chat' })
	const [input, setInput] = useState('')
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const isLoading = status === 'submitted' || status === 'streaming'

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	const handleSend = () => {
		const text = input.trim()
		if (!text || isLoading) return
		setInput('')
		sendMessage({ text })
	}

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
					Live Data Syncing
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
						messages.map((message) => (
							<div
								key={message.id}
								className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
							>
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
										<ReactMarkdown>
											{getMessageText(message)}
										</ReactMarkdown>
									</div>
								</div>
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
				<div className="max-w-3xl mx-auto relative">
					<input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type your message about F1..."
						className="w-full p-4 pr-16 bg-white/10 border border-white/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-red-600/70 focus:border-red-600 transition-all placeholder:text-white/50"
					/>
					<button
						onClick={handleSend}
						disabled={isLoading || !input.trim()}
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

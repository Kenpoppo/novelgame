import type { Instruction, ParsedScript } from './types'

export interface VMCallbacks {
  onDialogue(
    speakerName: string | null,
    color: string | undefined,
    imageDataUrl: string | undefined,
    text: string,
  ): void
  onChoice(options: { text: string; target: string }[]): void
  onBgm(src: string | null): void
  onSe(src: string): void
  onEnd(): void
}

export class ScriptVM {
  private readonly script: ParsedScript
  private readonly callbacks: VMCallbacks
  private pointer = 0

  constructor(script: ParsedScript, callbacks: VMCallbacks) {
    this.script = script
    this.callbacks = callbacks
  }

  start(): void {
    this.run()
  }

  advance(): void {
    const current = this.script.instructions[this.pointer]
    if (current?.type === 'choice') return
    this.pointer++
    this.run()
  }

  choose(target: string): void {
    this.jumpTo(target)
    this.run()
  }

  private jumpTo(target: string): void {
    const index = this.script.labels[target]
    if (index === undefined) {
      throw new Error(`ラベルが見つかりません: "${target}"`)
    }
    this.pointer = index
  }

  private run(): void {
    if (this.pointer >= this.script.instructions.length) {
      this.callbacks.onEnd()
      return
    }
    this.execute(this.script.instructions[this.pointer]!)
  }

  private execute(instruction: Instruction): void {
    switch (instruction.type) {
      case 'dialogue': {
        const character = instruction.speaker ? this.script.characters[instruction.speaker] : undefined
        this.callbacks.onDialogue(character?.name ?? null, character?.color, character?.imageDataUrl, instruction.text)
        break
      }
      case 'jump': {
        this.jumpTo(instruction.target)
        this.run()
        break
      }
      case 'choice': {
        this.callbacks.onChoice(instruction.options)
        break
      }
      case 'bgm': {
        this.callbacks.onBgm(instruction.src)
        this.pointer++
        this.run()
        break
      }
      case 'se': {
        this.callbacks.onSe(instruction.src)
        this.pointer++
        this.run()
        break
      }
    }
  }
}

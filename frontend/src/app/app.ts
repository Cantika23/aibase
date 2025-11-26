import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatInterface } from './components/chat-interface/chat-interface';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatInterface],
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('ai-chat');
}

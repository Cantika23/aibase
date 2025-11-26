import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatInterface } from './chat-interface';

describe('ChatInterface', () => {
  let component: ChatInterface;
  let fixture: ComponentFixture<ChatInterface>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatInterface]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatInterface);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

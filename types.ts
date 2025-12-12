import React from 'react';

export interface Language {
  id: string;
  name: string;
  nativeName: string;
  greeting: string;
  flagEmoji?: string;
}

export interface UserSession {
  hasOnboarded: boolean;
  language: Language | null;
}

export interface StudySession {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  sourceCount: number;
  gradient: string;
  icon?: string;
}

export interface StudioTool {
  id: string;
  name: string;
  icon: React.ReactNode;
}
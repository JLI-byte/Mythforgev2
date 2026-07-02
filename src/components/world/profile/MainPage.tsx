import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
export default function MainPage({ profile, name }: { profile: CharacterProfile; name: string }) {
    return <div>{name}</div>;
}

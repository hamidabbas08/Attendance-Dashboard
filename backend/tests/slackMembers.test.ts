import { mapSlackMembers } from '../src/slack/members';

describe('mapSlackMembers', () => {
  it('keeps humans and drops bots, deleted users and Slackbot', () => {
    const raw = [
      { id: 'U1', profile: { real_name: 'Alice', email: 'alice@x.test' } },
      { id: 'U2', is_bot: true, profile: { real_name: 'A Bot' } },
      { id: 'U3', deleted: true, profile: { real_name: 'Gone' } },
      { id: 'USLACKBOT', profile: { real_name: 'Slackbot' } },
      { id: 'U4', name: 'charlie', profile: { display_name: 'Charlie C' } },
    ];
    const out = mapSlackMembers(raw);
    expect(out.map((m) => m.slackUserId)).toEqual(['U1', 'U4']);
    expect(out[0]).toEqual({ slackUserId: 'U1', name: 'Alice', email: 'alice@x.test' });
    // Falls back to display_name, then blank email.
    expect(out[1]).toEqual({ slackUserId: 'U4', name: 'Charlie C', email: '' });
  });

  it('handles missing profile/name gracefully', () => {
    expect(mapSlackMembers([{ id: 'U9' }])).toEqual([
      { slackUserId: 'U9', name: 'U9', email: '' },
    ]);
  });
});

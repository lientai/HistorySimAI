export function checkGoalCompleted(goalId, state) {
  const nation = state.nation || {};
  const loyalty = state.loyalty || {};
  const ministers = state.ministers || [];

  switch (goalId) {
    case "survive_10":
      return (state.currentDay || 1) >= 10;

    case "treasury_up":
      return (nation.treasury || 0) >= 800000;

    case "morale_60":
      return (nation.civilMorale || 0) >= 60;

    case "loyalty_all_50": {
      if (ministers.length === 0) return false;
      return ministers.every((m) => (loyalty[m.id] || 0) >= 50);
    }

    case "border_down":
      return (nation.borderThreat || 100) <= 50;

    case "talk_all": {
      const chats = state.courtChats || {};
      if (ministers.length === 0) return false;
      return ministers.every((m) => Array.isArray(chats[m.id]) && chats[m.id].length > 0);
    }

    case "eliminate_external": {
      const external = state.externalPowers || {};
      const values = Object.values(external);
      if (values.length === 0) return false;
      return values.every((v) => (v || 0) <= 0);
    }

    default:
      return false;
  }
}

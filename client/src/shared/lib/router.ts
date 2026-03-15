import { useState, useEffect } from "react";

export type Route =
  | { page: "main" }
  | { page: "online-create" }
  | { page: "online-room"; roomId: string }
  | { page: "online-farewell" };

export function parseHash(hash: string): Route {
  if (hash.startsWith("#/online/create")) return { page: "online-create" };
  if (hash === "#/online/farewell") return { page: "online-farewell" };
  const roomMatch = hash.match(/^#\/online\/room\/(.+)$/);
  if (roomMatch) return { page: "online-room", roomId: roomMatch[1] };
  return { page: "main" };
}

export function navigateTo(route: Route): void {
  switch (route.page) {
    case "main":
      window.location.hash = "";
      break;
    case "online-create":
      window.location.hash = "#/online/create";
      break;
    case "online-room":
      window.location.hash = `#/online/room/${route.roomId}`;
      break;
    case "online-farewell":
      window.location.hash = "#/online/farewell";
      break;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash),
  );

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return route;
}

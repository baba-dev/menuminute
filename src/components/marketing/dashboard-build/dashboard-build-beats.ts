"use client";

import { createContext } from "react";

/**
 * Whether the new order has landed (the scroll has passed the table beat). The floor and Today's
 * pulse panels re-render from this because their data, not just their text, changes. The default is
 * the finished state, which is what server rendering and no-JS visitors get.
 */
export const NewOrderContext = createContext(true);

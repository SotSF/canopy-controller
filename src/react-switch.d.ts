declare module "react-switch" {
  import * as React from "react";

  export interface ReactSwitchProps {
    checked: boolean;
    onChange: (
      checked: boolean,
      event: React.SyntheticEvent<MouseEvent | KeyboardEvent> | MouseEvent,
      id: string,
    ) => void;
    disabled?: boolean;
    className?: string;
    offColor?: string;
    onColor?: string;
    offHandleColor?: string;
    onHandleColor?: string;
    height?: number;
    width?: number;
  }

  export default class ReactSwitch extends React.Component<ReactSwitchProps> {}
}

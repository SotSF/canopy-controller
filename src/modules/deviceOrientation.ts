import { useCallback, useEffect, useMemo, useState } from "react";
import { throttle } from "lodash";
import { EventType, sendEvent } from "./events";

type DeviceOrientation = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
};

type UseDeviceOrientationData = {
  orientation: DeviceOrientation | null;
  error: Error | null;
  requestAccess: () => Promise<boolean>;
  revokeAccess: () => Promise<void>;
};

export const useDeviceOrientation = (): UseDeviceOrientationData => {
  const [error, setError] = useState<Error | null>(null);
  const [orientation, setOrientation] = useState<DeviceOrientation | null>(
    null,
  );

  const onDeviceOrientation = useMemo(
    () =>
      throttle((event: DeviceOrientationEvent): void => {
        const newOrientation = {
          alpha: event.alpha || 0,
          beta: event.beta || 0,
          gamma: event.gamma || 0,
        };
        setOrientation(newOrientation);
        sendEvent({ event: EventType.Gyro, ...newOrientation });
      }, 50),
    [setOrientation],
  );

  const revokeAccessAsync = async (): Promise<void> => {
    window.removeEventListener("deviceorientation", onDeviceOrientation);
    setOrientation(null);
  };

  const requestAccessAsync = async (): Promise<boolean> => {
    if (!DeviceOrientationEvent) {
      setError(
        new Error("Device orientation event is not supported by your browser"),
      );
      return false;
    }

    if (
      (DeviceOrientationEvent as any).requestPermission &&
      typeof (DeviceMotionEvent as any).requestPermission === "function"
    ) {
      let permission: PermissionState;
      try {
        permission = await (DeviceOrientationEvent as any).requestPermission();
      } catch (err: any) {
        setError(err);
        return false;
      }
      if (permission !== "granted") {
        setError(
          new Error("Request to access the device orientation was rejected"),
        );
        return false;
      }
    }

    window.addEventListener("deviceorientation", onDeviceOrientation);

    return true;
  };

  const requestAccess = useCallback(requestAccessAsync, [onDeviceOrientation]);
  const revokeAccess = useCallback(revokeAccessAsync, [onDeviceOrientation]);

  useEffect(() => {
    return (): void => {
      revokeAccess();
    };
  }, [revokeAccess]);

  return {
    orientation,
    error,
    requestAccess,
    revokeAccess,
  };
};

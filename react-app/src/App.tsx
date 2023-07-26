import { useState, useCallback, useRef, useEffect } from "react";
import anime from "animejs";

interface Producer {
  id: "blue" | "red" | "green" | "orange" | "yellow";
  sending: boolean;
  animation?: NodeJS.Timer;
  shuttingDown?: boolean;
  shuttingDownAnimation?: NodeJS.Timer;
  shutDownComplete?: boolean;
}

function randomItemFromArray<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function App() {
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);

  const [blueSend, setBlueSend] = useState<Producer>({
    id: "blue",
    sending: false,
  });
  const [redSend, setRedSend] = useState<Producer>({
    id: "red",
    sending: false,
  });
  const [greenSend, setGreenSend] = useState<Producer>({
    id: "green",
    sending: false,
  });
  const [orangeSend, setOrangeSend] = useState<Producer>({
    id: "orange",
    sending: false,
  });
  const [yellowSend, setYellowSend] = useState<Producer>({
    id: "yellow",
    sending: false,
  });

  const [polling, setPolling] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);

  const throttleRef = useRef(false);

  const [pollController, setPollController] = useState<{
    status: "request" | "response";
    data?: Array<{ color: string; amount: number }>;
  }>();

  useEffect(() => {
    console.log(process.env.REACT_APP_API_GATEWAY_ENDPOINT);
    const timer = setInterval(() => {
      const newValue = Math.random() < 0.1;
      throttleRef.current = newValue;
    }, 100);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const startGenerating = useCallback(
    (colorSend: typeof blueSend, setColorSend: typeof setBlueSend) => {
      const createAnimation = () => {
        const itemContainer = document.createElement("div");
        itemContainer.className =
          "absolute h-10 w-10 flex justify-center items-center pointer-events-none";
        const item = document.createElement("div");
        item.className = `h-[2px] w-[4px] rounded-[3px] bg-${colorSend.id}-500 opacity-90`;
        itemContainer.appendChild(item);
        leftColumnRef.current
          ?.getElementsByClassName(colorSend.id)[0]
          .appendChild(itemContainer);

        // deltaX is half the length of the length of the left columns parent container - the width of the item
        const deltaX =
          ((leftColumnRef.current?.parentElement?.getBoundingClientRect()
            .width || 0 / 2) -
            (leftColumnRef.current?.getBoundingClientRect().width || 0 / 2)) /
          2;

        const greenItem = leftColumnRef.current?.getElementsByClassName(
          "green"
        )![0] as HTMLDivElement;

        // deltaY is the distance between the item and the green item
        const deltaY =
          greenItem.getBoundingClientRect().top -
          itemContainer.getBoundingClientRect().top -
          randomItemFromArray([-10, -5, 0, 5, 10]);
        const childAnimation = anime({
          targets: item,
          height: 4,
          width: 16,
          duration: 1000,
          easing: "easeInOutExpo",
        });
        const animation = anime({
          targets: itemContainer,
          translateX: deltaX,
          translateY: [
            { value: 0, duration: 0 },
            {
              value: deltaY,
              duration: 1000,
              easing: function () {
                return function (t: number) {
                  return (
                    (t - 0.275) /
                    (t - 0.275 + (1 - t) * Math.exp(-25 * (t - 0.5 - 0.275)))
                  );
                };
              },
            },
          ],
          duration: 1000,
          easing: "easeInQuad",
          complete: function () {
            itemContainer.remove();
          },
        });
      };

      const animate = async (maxout: boolean) => {
        const boolArray = maxout
          ? Array.from(
              {
                length: randomItemFromArray([80, 90, 100]),
              },
              () => Math.random() < randomItemFromArray([0.5, 0.6, 0.7])
            )
          : Array.from(
              {
                length: randomItemFromArray([
                  4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 20, 21, 25, 27, 28,
                  50, 100,
                ]),
              },
              () =>
                Math.random() <
                randomItemFromArray([0.3, 0.4, 0.5, 0.7, 0.8, 0.9])
            );

        const total =
          boolArray.reduce((acc, curr) => {
            if (curr) {
              return acc + 1;
            }
            return acc;
          }, 0) || 1;

        if (boolArray.length === 0) {
          createAnimation();
        }
        for (let i = 0; i < boolArray.length; i++) {
          if (boolArray[i]) {
            createAnimation();
          }
          await delay(10);
        }

        setTimeout(() => {
          fetch(process.env.REACT_APP_API_GATEWAY_ENDPOINT! + "/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              color: colorSend.id,
              amount: total,
            }),
          })
            .then((response) => response.json()) // Assuming server responds with json
            .then((data) => console.log(data))
            .catch((error) => console.error("Error:", error));
        }, 1000);
      };

      animate(throttleRef.current);

      let flag = false;

      const interval = setInterval(() => {
        setColorSend((colorSend) => {
          if (flag) {
            return colorSend;
          }
          if (colorSend.shuttingDown) {
            flag = true;
            clearInterval(colorSend.animation!);
            return {
              id: colorSend.id,
              sending: false,
              shuttingDown: false,
              shuttingDownAnimation: colorSend.shuttingDownAnimation,
              shutDownComplete: colorSend.shutDownComplete,
            };
          }
          animate(throttleRef.current);
          return colorSend;
        });
      }, 1250);

      setColorSend({
        id: colorSend.id,
        sending: true,
        animation: interval,
        shuttingDown: false,
        shuttingDownAnimation: undefined,
        shutDownComplete: undefined,
      });
    },
    []
  );
  const stopGenerating = useCallback(
    (colorSend: typeof blueSend, setColorSend: typeof setBlueSend) => {
      setColorSend({
        sending: true,
        id: colorSend.id,
        shuttingDown: true,
        animation: colorSend.animation,
        shutDownComplete: false,
        shuttingDownAnimation: setTimeout(() => {
          setColorSend((colorSend) => {
            return { ...colorSend, shutDownComplete: true };
          });
        }, 1500),
      });
    },
    []
  );

  const returnStreamDataAnimation = useCallback(
    (color: string, lastItem: boolean) => {
      console.log(color);

      const requestAnimation = (
        color: string,
        offset: string,
        makeRequest?: boolean
      ) => {
        const itemContainer = document.createElement("div");
        itemContainer.className =
          "absolute top-0 h-16 w-16 max-h-[17.5vw] max-w-[17.5vw] flex justify-center items-center pointer-events-none -z-10";
        const item = document.createElement("div");
        item.className = `h-[2px] w-[4px] rounded-[3px] bg-${color}-500 opacity-90 ${offset}`;
        itemContainer.appendChild(item);
        rightColumnRef.current?.firstChild?.appendChild(itemContainer);

        const deltaX =
          ((leftColumnRef.current?.parentElement?.getBoundingClientRect()
            .width || 0 / 2) -
            (leftColumnRef.current?.getBoundingClientRect().width || 0 / 2)) /
          2;

        const childAnimation = anime({
          targets: item,
          height: 4,
          width: 16,
          duration: 1000,
          easing: "easeOutExpo",
        });
        const animation = anime({
          targets: itemContainer,
          translateX: [
            { value: -deltaX, duration: 0 },
            {
              value: 0,
              duration: 1000,
            },
          ],
          duration: 1000,
          easing: "easeInQuad",
          complete: async function () {
            itemContainer.remove();
            if (makeRequest) {
              let data: Array<{ color: string; amount: number }>;
              try {
                const response = await fetch(
                  process.env.REACT_APP_API_GATEWAY_ENDPOINT! + "/poll"
                );
                data = await response.json();
                if (
                  typeof data === "object" &&
                  (data as unknown as { error: string }).error
                )
                  throw new Error((data as unknown as { error: string }).error);
              } catch (error) {
                data = [];
              }

              setPollController({
                status: "response",
                data: data as Array<{ color: string; amount: number }>,
              });
            }
          },
        });
      };

      requestAnimation(
        color,
        randomItemFromArray([
          "-translate-y-[10px]",
          "-translate-y-[5px]",
          "",
          "translate-y-[5px]",
          "translate-y-[10px]",
        ])
      );

      if (lastItem) {
        const handleLastItem = async () => {
          console.log("last item");
          await delay(1000);
          const handleComplete = () => {
            let flag = false;
            setPolling((polling) => {
              if (!flag) {
                if (polling) {
                  setPollController({ status: "request" });
                } else {
                  setShuttingDown(false);
                }
              }
              flag = true;
              return polling;
            });
          };
          handleComplete();
        };
        handleLastItem();
      }
    },
    []
  );

  const startPolling = useCallback(() => {
    setPolling(true);

    const requestAnimation = (
      color: string,
      offset: string,
      makeRequest?: boolean
    ) => {
      const itemContainer = document.createElement("div");
      itemContainer.className =
        "absolute top-0 h-16 w-16 max-h-[17.5vw] max-w-[17.5vw] flex justify-center items-center pointer-events-none -z-10";
      const item = document.createElement("div");
      item.className = `h-[2px] w-[4px] rounded-[3px] bg-${color}-500 opacity-90 ${offset}`;
      itemContainer.appendChild(item);
      rightColumnRef.current?.firstChild?.appendChild(itemContainer);

      const deltaX =
        ((leftColumnRef.current?.parentElement?.getBoundingClientRect().width ||
          0 / 2) -
          (leftColumnRef.current?.getBoundingClientRect().width || 0 / 2)) /
        2;

      const childAnimation = anime({
        targets: item,
        height: 4,
        width: 16,
        duration: 1000,
        easing: "easeOutExpo",
      });
      const animation = anime({
        targets: itemContainer,
        translateX: -deltaX,
        duration: 1000,
        easing: "easeInQuad",
        complete: async function () {
          itemContainer.remove();
          if (makeRequest) {
            let data: Array<{ color: string; amount: number }>;
            try {
              const response = await fetch(
                process.env.REACT_APP_API_GATEWAY_ENDPOINT! + "/poll"
              );
              data = await response.json();
              if (
                typeof data === "object" &&
                (data as unknown as { error: string }).error
              )
                throw new Error((data as unknown as { error: string }).error);
            } catch (error) {
              data = [];
            }

            setPollController({
              status: "response",
              data: data as Array<{ color: string; amount: number }>,
            });
          }
        },
      });
    };

    requestAnimation(
      "blue",
      randomItemFromArray([
        "-translate-y-[10px]",
        "-translate-y-[5px]",
        "",
        "translate-y-[5px]",
        "translate-y-[10px]",
      ])
    );
    setTimeout(() => {
      requestAnimation(
        "red",
        randomItemFromArray([
          "-translate-y-[10px]",
          "-translate-y-[5px]",
          "",
          "translate-y-[5px]",
          "translate-y-[10px]",
        ])
      );
    }, 50);
    setTimeout(() => {
      requestAnimation(
        "green",
        randomItemFromArray([
          "-translate-y-[10px]",
          "-translate-y-[5px]",
          "",
          "translate-y-[5px]",
          "translate-y-[10px]",
        ])
      );
    }, 100);
    setTimeout(() => {
      requestAnimation(
        "orange",
        randomItemFromArray([
          "-translate-y-[10px]",
          "-translate-y-[5px]",
          "",
          "translate-y-[5px]",
          "translate-y-[10px]",
        ])
      );
    }, 150);
    setTimeout(() => {
      requestAnimation(
        "yellow",
        randomItemFromArray([
          "-translate-y-[10px]",
          "-translate-y-[5px]",
          "",
          "translate-y-[5px]",
          "translate-y-[10px]",
        ]),
        true
      );
    }, 200);
  }, []);

  useEffect(() => {
    if (pollController?.status === "response") {
      const data = pollController.data!;
      if (data.length === 0) {
        const handleComplete = () => {
          let flag = false;
          setPolling((polling) => {
            if (!flag) {
              if (polling) {
                setPollController({ status: "request" });
              } else {
                setShuttingDown(false);
              }
            }
            flag = true;
            return polling;
          });
        };
        handleComplete();
      } else {
        const animateReturnedStreamData = async () => {
          for (let i = 0; i < data.length; i++) {
            const items = Array.from(
              {
                length: data[i].amount,
              },
              () => data[i]
            );
            for (let j = 0; j < items.length; j++) {
              returnStreamDataAnimation(
                items[j].color,
                i === data.length - 1 && j === items.length - 1
              );
              await delay(10);
            }
          }
        };
        animateReturnedStreamData();
      }
    } else if (pollController?.status === "request") {
      startPolling();
    }
  }, [pollController, returnStreamDataAnimation, startPolling]);

  const stopPolling = useCallback(() => {
    setShuttingDown(true);
    setPolling(false);
  }, []);

  return (
    <>
      <div className="mx-auto h-screen max-w-[980px] w-full p-6 flex flex-col justify-center z-50">
        <div className="hidden bg-blue-500 bg-red-500 bg-green-500 bg-orange-500 bg-yellow-500" />
        <div className="flex justify-between items-center">
          {/* left */}
          <div
            className="flex flex-col [&>div]:mt-4 [&>div:first-of-type]:mt-0"
            ref={leftColumnRef}
          >
            <div className="blue w-10 h-10 flex justify-center items-center">
              <div
                onClick={() =>
                  blueSend.shuttingDown || blueSend.shutDownComplete === false
                    ? null
                    : !blueSend.sending
                    ? startGenerating(blueSend, setBlueSend)
                    : stopGenerating(blueSend, setBlueSend)
                }
                className={`${
                  blueSend.shuttingDown || blueSend.shutDownComplete === false
                    ? "cursor-not-allowed scale-90 brightness-75"
                    : blueSend.sending
                    ? "scale-90 cursor-pointer"
                    : "grayscale hover:grayscale-0 hover:scale-95 group cursor-pointer"
                } relative group flex justify-center items-center h-full w-full rounded-lg transition-all ease-out z-10`}
                style={{
                  boxShadow:
                    blueSend.shuttingDown || blueSend.shutDownComplete === false
                      ? ""
                      : blueSend.sending
                      ? "0px 0px 40px 18px rgba(40,75,240,1)"
                      : "",
                }}
              >
                <img
                  className={`${
                    blueSend.shuttingDown ||
                    (blueSend.shutDownComplete === false && "animate-pulse")
                  } lambda h-full w-full rounded hue-rotate-180`}
                  src="/Amazon_Lambda_architecture_logo.svg.png"
                  alt="lambda"
                />
                <i
                  className={`${
                    blueSend.sending ||
                    blueSend.shuttingDown ||
                    blueSend.shutDownComplete === false
                      ? "fa-spin opacity-100"
                      : "opacity-90 group-hover:opacity-95"
                  } fa-solid fa-gear absolute -top-1.5 -right-2.5 text-xl transition-opacity`}
                />
              </div>
            </div>
            <div className="red w-10 h-10 flex justify-center items-center">
              <div
                onClick={() =>
                  redSend.shuttingDown || redSend.shutDownComplete === false
                    ? null
                    : !redSend.sending
                    ? startGenerating(redSend, setRedSend)
                    : stopGenerating(redSend, setRedSend)
                }
                className={`${
                  redSend.shuttingDown || redSend.shutDownComplete === false
                    ? "cursor-not-allowed scale-90 brightness-75"
                    : redSend.sending
                    ? "scale-90 cursor-pointer"
                    : "grayscale hover:grayscale-0 hover:scale-95 group cursor-pointer"
                } relative group flex justify-center items-center h-full w-full rounded-lg transition-all ease-out z-10`}
                style={{
                  boxShadow:
                    redSend.shuttingDown || redSend.shutDownComplete === false
                      ? ""
                      : redSend.sending
                      ? "0px 0px 40px 10px rgba(240,19,19,1)"
                      : "",
                }}
              >
                <img
                  className={`${
                    redSend.shuttingDown ||
                    (redSend.shutDownComplete === false && "animate-pulse")
                  } lambda h-full w-full rounded -hue-rotate-[30deg] saturate-[1.4] brightness-[1] sepia-[.1]`}
                  src="/Amazon_Lambda_architecture_logo.svg.png"
                  alt="lambda"
                />
                <i
                  className={`${
                    redSend.sending ||
                    redSend.shuttingDown ||
                    redSend.shutDownComplete === false
                      ? "fa-spin opacity-100"
                      : "opacity-90 group-hover:opacity-95"
                  } fa-solid fa-gear absolute -top-1.5 -right-2.5 text-xl transition-opacity`}
                />
              </div>
            </div>
            <div className="green w-10 h-10 flex justify-center items-center">
              <div
                onClick={() =>
                  greenSend.shuttingDown || greenSend.shutDownComplete === false
                    ? null
                    : !greenSend.sending
                    ? startGenerating(greenSend, setGreenSend)
                    : stopGenerating(greenSend, setGreenSend)
                }
                className={`${
                  greenSend.shuttingDown || greenSend.shutDownComplete === false
                    ? "cursor-not-allowed scale-90 brightness-75"
                    : greenSend.sending
                    ? "scale-90 cursor-pointer"
                    : "grayscale hover:grayscale-0 hover:scale-95 group cursor-pointer"
                } relative group flex justify-center items-center h-full w-full rounded-lg transition-all ease-out z-10`}
                style={{
                  boxShadow:
                    greenSend.shuttingDown ||
                    greenSend.shutDownComplete === false
                      ? ""
                      : greenSend.sending
                      ? "0px 0px 45px 13px rgba(40,200,40,.75)"
                      : "",
                }}
              >
                <img
                  className={`${
                    greenSend.shuttingDown ||
                    (greenSend.shutDownComplete === false && "animate-pulse")
                  } lambda h-full w-full rounded hue-rotate-[90deg] brightness-110 sepia-[.1] saturate-[1.2]`}
                  src="/Amazon_Lambda_architecture_logo.svg.png"
                  alt="lambda"
                />
                <i
                  className={`${
                    greenSend.sending ||
                    greenSend.shuttingDown ||
                    greenSend.shutDownComplete === false
                      ? "fa-spin opacity-100"
                      : "opacity-90 group-hover:opacity-95"
                  } fa-solid fa-gear absolute -top-1.5 -right-2.5 text-xl transition-opacity`}
                />
              </div>
            </div>
            <div className="orange w-10 h-10 flex justify-center items-center">
              <div
                onClick={() =>
                  orangeSend.shuttingDown ||
                  orangeSend.shutDownComplete === false
                    ? null
                    : !orangeSend.sending
                    ? startGenerating(orangeSend, setOrangeSend)
                    : stopGenerating(orangeSend, setOrangeSend)
                }
                className={`${
                  orangeSend.shuttingDown ||
                  orangeSend.shutDownComplete === false
                    ? "cursor-not-allowed scale-90 brightness-75"
                    : orangeSend.sending
                    ? "scale-90 cursor-pointer"
                    : "grayscale hover:grayscale-0 hover:scale-95 group cursor-pointer"
                } relative group flex justify-center items-center h-full w-full rounded-lg transition-all ease-out z-10`}
                style={{
                  boxShadow:
                    orangeSend.shuttingDown ||
                    orangeSend.shutDownComplete === false
                      ? ""
                      : orangeSend.sending
                      ? "0px 0px 45px 12px rgba(200,100,40,.9)"
                      : "",
                }}
              >
                <img
                  className={`${
                    orangeSend.shuttingDown ||
                    (orangeSend.shutDownComplete === false && "animate-pulse")
                  } lambda h-full w-full rounded`}
                  src="/Amazon_Lambda_architecture_logo.svg.png"
                  alt="lambda"
                />
                <i
                  className={`${
                    orangeSend.sending ||
                    orangeSend.shuttingDown ||
                    orangeSend.shutDownComplete === false
                      ? "fa-spin opacity-100"
                      : "opacity-90 group-hover:opacity-95"
                  } fa-solid fa-gear absolute -top-1.5 -right-2.5 text-xl transition-opacity`}
                />
              </div>
            </div>
            <div className="yellow w-10 h-10 flex justify-center items-center">
              <div
                onClick={() =>
                  yellowSend.shuttingDown ||
                  yellowSend.shutDownComplete === false
                    ? null
                    : !yellowSend.sending
                    ? startGenerating(yellowSend, setYellowSend)
                    : stopGenerating(yellowSend, setYellowSend)
                }
                className={`${
                  yellowSend.shuttingDown ||
                  yellowSend.shutDownComplete === false
                    ? "cursor-not-allowed scale-90 brightness-75"
                    : yellowSend.sending
                    ? "scale-90 cursor-pointer"
                    : "grayscale hover:grayscale-0 hover:scale-95 group cursor-pointer"
                } relative group flex justify-center items-center h-full w-full rounded-lg transition-all ease-out z-10`}
                style={{
                  boxShadow:
                    yellowSend.shuttingDown ||
                    yellowSend.shutDownComplete === false
                      ? ""
                      : yellowSend.sending
                      ? "0px 0px 45px 6px rgba(200,200,40,.7)"
                      : "",
                }}
              >
                <img
                  className={`${
                    yellowSend.shuttingDown ||
                    (yellowSend.shutDownComplete === false && "animate-pulse")
                  } ${
                    yellowSend.shuttingDown ||
                    yellowSend.shutDownComplete === false
                      ? "saturate-[3.2] brightness-[1.275]"
                      : yellowSend.sending
                      ? "saturate-[3.2] brightness-[1.275]"
                      : "hover:saturate-[3.2] hover:brightness-[1.275]"
                  }
                  lambda h-full w-full rounded hue-rotate-[30deg] sepia-[.1]`}
                  src="/Amazon_Lambda_architecture_logo.svg.png"
                  alt="lambda"
                />
                <i
                  className={`${
                    yellowSend.sending ||
                    yellowSend.shuttingDown ||
                    yellowSend.shutDownComplete === false
                      ? "fa-spin opacity-100"
                      : "opacity-90 group-hover:opacity-95"
                  } fa-solid fa-gear absolute -top-1.5 -right-2.5 text-xl transition-opacity`}
                />
              </div>
            </div>
          </div>
          {/* middle */}
          <div className="relative h-full flex justify-center items-center no-highlight pointer-events-none">
            <div className="absolute top-0 left-0 h-full w-full flex justify-center items-center">
              <img
                className="w-96 max-w-[50vw] /opacity-75 blur-[4px] mb-6 cloud-animation -z-10 opacity-80"
                src="/realistic-cloud.png"
                alt="cloud"
              />
            </div>
            <div className="h-16 w-16 max-h-[17.5vw] max-w-[17.5vw]">
              <img
                className="h-full w-full rounded-lg server-animation z-50"
                src="/kinesis.jpg"
                alt="kinesis logo"
              />
            </div>
          </div>
          {/* right */}
          <div
            ref={rightColumnRef}
            className="flex flex-col [&>div]:mt-4 [&>div:first-of-type]:mt-0"
          >
            <div className="relative h-16 w-16 max-h-[17.5vw] max-w-[17.5vw]">
              <div
                onClick={() =>
                  shuttingDown ? null : polling ? stopPolling() : startPolling()
                }
                className={`${
                  shuttingDown
                    ? "cursor-not-allowed scale-90 brightness-75"
                    : polling
                    ? "scale-90 cursor-pointer"
                    : "grayscale hover:grayscale-0 hover:scale-95 group cursor-pointer"
                } relative flex justify-center items-center h-full w-full rounded-lg transition-all ease-out z-10`}
                style={{
                  boxShadow: polling
                    ? "0px 0px 44px 4px rgba(240, 94, 10,.9)"
                    : "",
                }}
              >
                <img
                  className={`${
                    shuttingDown && "animate-pulse"
                  } lambda h-full w-full rounded-lg`}
                  src="/Amazon_Lambda_architecture_logo.svg.png"
                  alt="lambda"
                />
                <i
                  className={`${
                    polling || shuttingDown
                      ? "fa-spin opacity-100"
                      : "opacity-90 group-hover:opacity-95"
                  } fa-solid fa-gear absolute -top-1 -right-3 text-3xl transition-opacity`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-0 background w-screen h-screen -z-50 pointer-events-none"></div>
    </>
  );
}

export default App;

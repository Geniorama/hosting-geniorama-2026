type LogoProps = {
  width?: number;
  height?: number;
  idSuffix?: string;
};

export function Logo({ width = 140, height = 22, idSuffix = "main" }: LogoProps) {
  const clipId = `gclip-${idSuffix}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 192.825 31.11"
      role="img"
      aria-label="Geniorama"
    >
      <defs>
        <clipPath id={clipId}>
          <path style={{ fill: "#fff" }} d="M0 0h192.825v31.109H0z" />
        </clipPath>
      </defs>
      <path
        d="M1.381 15.555 15.555 1.381l14.173 14.174-14.173 14.174zM15.555 0 0 15.555l15.555 15.554 15.554-15.554z"
        style={{ fill: "#fff" }}
      />
      <path
        d="M24.659 35.757 13.525 24.614 24.6 13.54l1.933 1.933-9.141 9.141 9.2 9.21z"
        transform="translate(-9.049 -9.059)"
        style={{ fill: "#fff" }}
      />
      <path
        d="m55.514 40.257-1.943-1.923 5.051-5.1-4.922-4.992 1.929-1.9 6.893 6.913z"
        transform="translate(-35.843 -17.623)"
        style={{ fill: "#fff" }}
      />
      <path
        transform="rotate(-45 25.068 -7.41)"
        style={{ fill: "#fff" }}
        d="M0 0h4.204v4.204H0z"
      />
      <g style={{ clipPath: `url(#${clipId})` }}>
        <path
          d="M117.642 29.97H125v8.336h-2.492v-2.152a6.369 6.369 0 0 1-5.346 2.447 7.977 7.977 0 0 1-8-8.223 8.055 8.055 0 0 1 8.223-8.224 7.747 7.747 0 0 1 7.611 5.5h-2.764a5.119 5.119 0 0 0-4.848-2.968 5.43 5.43 0 0 0-5.618 5.686 5.5 5.5 0 0 0 5.618 5.8c2.628 0 4.78-1.359 5.006-3.874h-4.757z"
          transform="translate(-73.043 -14.823)"
          style={{ fill: "#fff" }}
        />
        <path
          d="M185.409 36.41v2.49h-9.288V23.044h9.179v2.492h-6.57v4.123h6v2.447h-6v4.3z"
          transform="translate(-117.838 -15.418)"
          style={{ fill: "#fff" }}
        />
        <path
          d="M233.245 23.044V38.9h-2.039l-6.683-10.76V38.9h-2.605V23.044h2.039L230.64 33.8V23.044z"
          transform="translate(-148.479 -15.418)"
          style={{ fill: "#fff" }}
        />
        <path
          transform="translate(91.426 7.626)"
          style={{ fill: "#fff" }}
          d="M0 0h2.605v15.857H0z"
        />
        <path
          d="M301.875 30.378A8.223 8.223 0 1 1 310.1 38.6a8.165 8.165 0 0 1-8.223-8.223m13.841 0a5.619 5.619 0 1 0-5.618 5.686 5.535 5.535 0 0 0 5.618-5.686"
          transform="translate(-201.976 -14.823)"
          style={{ fill: "#fff" }}
        />
        <path
          d="M374.379 33.126h-2.469V38.9h-2.61V23.045h5.89a5.036 5.036 0 0 1 1.971 9.7l5.165 6.162h-3.1zm-2.469-2.333h3.285a2.655 2.655 0 0 0 0-5.3h-3.285z"
          transform="translate(-247.092 -15.419)"
          style={{ fill: "#fff" }}
        />
        <path
          d="M429.013 35.707h-6.592l-1.064 3.193h-2.832l5.64-15.857h3.126L432.91 38.9h-2.81zm-.838-2.447-2.447-7.249-2.469 7.249z"
          transform="translate(-280.024 -15.418)"
          style={{ fill: "#fff" }}
        />
        <path
          d="M492.849 38.9h-2.605V27.348l-3.965 8.952h-2.039l-3.964-8.948V38.9h-2.605V23.044h3.035l4.554 10.239 4.553-10.239h3.036z"
          transform="translate(-319.597 -15.418)"
          style={{ fill: "#fff" }}
        />
        <path
          d="M549.7 35.707h-6.59l-1.065 3.193h-2.832l5.641-15.857h3.126L553.6 38.9h-2.809zm-.838-2.447-2.446-7.249-2.469 7.249z"
          transform="translate(-360.773 -15.418)"
          style={{ fill: "#fff" }}
        />
      </g>
    </svg>
  );
}
